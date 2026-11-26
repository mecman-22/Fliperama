-- =====================================================================
--  Fliperama: banco do ranking e do progresso salvo na nuvem (Supabase)
--  Como usar: no painel do Supabase, abra "SQL Editor", cole tudo isto
--  e clique em "Run". Pode rodar de novo sem problema.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- Jogadores: nick único (sem diferenciar maiúsculas) + PIN guardado com hash
create table if not exists public.jogadores (
  nick          text primary key check (nick ~ '^[A-Za-z0-9_.]{3,16}$' and nick ~ '[A-Za-z0-9]'),
  nick_lower    text unique not null,
  pin_hash      text not null,
  falhas        int  not null default 0,
  bloqueado_ate timestamptz,
  criado_em     timestamptz not null default now()
);

-- Sessões: cada aparelho logado recebe um token
create table if not exists public.sessoes (
  token     uuid primary key default gen_random_uuid(),
  nick      text not null references public.jogadores(nick) on delete cascade,
  criado_em timestamptz not null default now()
);

-- Progresso de cada jogador em cada jogo + pontuação do ranking
create table if not exists public.progresso (
  nick          text not null references public.jogadores(nick) on delete cascade,
  jogo          text not null check (jogo ~ '^[a-z0-9-]{1,40}$'),
  dados         jsonb not null default '{}'::jsonb,
  pontos        bigint not null default 0,
  atualizado_em timestamptz not null default now(),
  primary key (nick, jogo)
);
create index if not exists progresso_ranking on public.progresso (jogo, pontos desc);

-- Segurança: ninguém lê nem grava as tabelas direto pelo site.
-- Todo acesso passa pelas funções abaixo.
alter table public.jogadores enable row level security;
alter table public.sessoes   enable row level security;
alter table public.progresso enable row level security;

-- Entrar: cria o nick se ele não existir; senão confere o PIN.
-- 5 PINs errados seguidos bloqueiam o nick por 10 minutos.
create or replace function public.entrar(p_nick text, p_pin text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare j public.jogadores; t uuid; novo boolean := false;
begin
  if p_nick is null or p_nick !~ '^[A-Za-z0-9_.]{3,16}$' or p_nick !~ '[A-Za-z0-9]' then raise exception 'NICK_INVALIDO'; end if;
  if p_pin  is null or p_pin  !~ '^[0-9]{4,8}$'          then raise exception 'PIN_INVALIDO';  end if;

  select * into j from public.jogadores where nick_lower = lower(p_nick) for update;
  if not found then
    insert into public.jogadores (nick, nick_lower, pin_hash)
    values (p_nick, lower(p_nick), crypt(p_pin, gen_salt('bf'))) returning * into j;
    novo := true;
  else
    if j.bloqueado_ate is not null and j.bloqueado_ate > now() then raise exception 'BLOQUEADO'; end if;
    if j.pin_hash <> crypt(p_pin, j.pin_hash) then
      update public.jogadores
         set falhas = case when falhas + 1 >= 5 then 0 else falhas + 1 end,
             bloqueado_ate = case when falhas + 1 >= 5 then now() + interval '10 minutes' else null end
       where nick = j.nick;
      return json_build_object('erro', 'PIN_ERRADO');
    end if;
    update public.jogadores set falhas = 0, bloqueado_ate = null where nick = j.nick;
  end if;

  delete from public.sessoes where nick = j.nick and criado_em < now() - interval '180 days';
  insert into public.sessoes (nick) values (j.nick) returning token into t;
  return json_build_object('nick', j.nick, 'token', t, 'novo', novo);
end $$;

-- Salvar o progresso de um jogo. A pontuação do ranking nunca diminui.
create or replace function public.salvar(p_token uuid, p_jogo text, p_dados jsonb, p_pontos bigint)
returns void language plpgsql security definer set search_path = public as $$
declare n text;
begin
  select nick into n from public.sessoes where token = p_token;
  if n is null then raise exception 'SESSAO_INVALIDA'; end if;
  if p_jogo is null or p_jogo !~ '^[a-z0-9-]{1,40}$' then raise exception 'JOGO_INVALIDO'; end if;
  if p_dados is null or pg_column_size(p_dados) > 20000 then raise exception 'DADOS_INVALIDOS'; end if;
  insert into public.progresso as p (nick, jogo, dados, pontos, atualizado_em)
  values (n, p_jogo, p_dados, greatest(coalesce(p_pontos, 0), 0), now())
  on conflict (nick, jogo) do update
     set dados = excluded.dados,
         pontos = greatest(p.pontos, excluded.pontos),
         atualizado_em = now();
end $$;

-- Carregar todo o progresso salvo do jogador logado
create or replace function public.carregar(p_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare n text; r json;
begin
  select nick into n from public.sessoes where token = p_token;
  if n is null then raise exception 'SESSAO_INVALIDA'; end if;
  select coalesce(json_object_agg(jogo, json_build_object('dados', dados, 'pontos', pontos)), '{}'::json)
    into r from public.progresso where nick = n;
  return json_build_object('nick', n, 'jogos', r);
end $$;

-- Ranking público de um jogo (só nick e pontos)
create or replace function public.ranking(p_jogo text, p_limite int default 20)
returns table (posicao bigint, nick text, pontos bigint)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by p.pontos desc, p.atualizado_em asc), p.nick, p.pontos
    from public.progresso p
   where p.jogo = p_jogo and p.pontos > 0
   order by p.pontos desc, p.atualizado_em asc
   limit least(greatest(coalesce(p_limite, 20), 1), 100);
$$;

-- Posição do jogador logado num jogo (para quem está fora do top)
create or replace function public.minha_posicao(p_token uuid, p_jogo text)
returns json language plpgsql stable security definer set search_path = public as $$
declare n text; pts bigint; pos bigint;
begin
  select nick into n from public.sessoes where token = p_token;
  if n is null then return null; end if;
  select pontos into pts from public.progresso where nick = n and jogo = p_jogo;
  if pts is null or pts = 0 then return null; end if;
  select count(*) + 1 into pos from public.progresso where jogo = p_jogo and pontos > pts;
  return json_build_object('nick', n, 'pontos', pts, 'posicao', pos);
end $$;

-- Sair (apaga o token deste aparelho)
create or replace function public.sair(p_token uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.sessoes where token = p_token;
$$;

revoke all on function public.entrar(text, text)                       from public;
revoke all on function public.salvar(uuid, text, jsonb, bigint)        from public;
revoke all on function public.carregar(uuid)                           from public;
revoke all on function public.ranking(text, int)                       from public;
revoke all on function public.minha_posicao(uuid, text)                from public;
revoke all on function public.sair(uuid)                               from public;
grant execute on function public.entrar(text, text)                    to anon, authenticated;
grant execute on function public.salvar(uuid, text, jsonb, bigint)     to anon, authenticated;
grant execute on function public.carregar(uuid)                        to anon, authenticated;
grant execute on function public.ranking(text, int)                    to anon, authenticated;
grant execute on function public.minha_posicao(uuid, text)             to anon, authenticated;
grant execute on function public.sair(uuid)                            to anon, authenticated;
