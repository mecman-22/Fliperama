-- Libera o "." no nick (ex.: pedro.silva). Rode uma vez no SQL Editor do Supabase.
-- O nick continua com 3 a 16 caracteres e precisa ter pelo menos uma letra ou número.
alter table public.jogadores drop constraint if exists jogadores_nick_check;
alter table public.jogadores add constraint jogadores_nick_check
  check (nick ~ '^[A-Za-z0-9_.]{3,16}$' and nick ~ '[A-Za-z0-9]');
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
