// Ranking e progresso na nuvem do Fliperama.
// Os jogos continuam salvando no navegador (localStorage) como sempre;
// este módulo copia essas chaves para o banco e traz de volta em outro aparelho.
(() => {
  const cfg = window.FLIPERAMA_CLOUD || {};
  const ready = !!(cfg.url && cfg.key);
  const base = String(cfg.url || '').replace(/\/+$/, '');

  const LS = {
    get(k) { try { return JSON.parse(localStorage.getItem('fliperama.' + k)); } catch (e) { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem('fliperama.' + k) : localStorage.setItem('fliperama.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  const val = (d, k) => { try { return JSON.parse(d[k]); } catch (e) { return null; } };

  // Que chaves cada jogo usa e como vira pontuação do ranking.
  const GAMES = {
    'role-neon':       { keys: ['role.coins', 'role.best', 'role.up', 'role.skins', 'role.skin'], pontos: d => +val(d, 'role.best') || 0, unidade: 'm' },
    'coletor-estelar': { keys: ['coletor-best'], pontos: d => +val(d, 'coletor-best') || 0, unidade: 'pontos' },
    'memoria-cores':   { keys: ['memoria-best'], pontos: d => +val(d, 'memoria-best') || 0, unidade: 'na sequência' },
    'jogo-da-velha':   { keys: ['velha.perfil'], pontos: d => +((val(d, 'velha.perfil') || {}).xp) || 0, unidade: 'XP' },
    // Sudoku: só guarda o progresso (melhores tempos); não entra no ranking.
    'sudoku':          { keys: ['sudoku-best'], pontos: d => Object.keys(val(d, 'sudoku-best') || {}).length, unidade: '', rank: false }
  };

  function localData(id) {
    const d = {};
    for (const k of GAMES[id].keys) { try { const v = localStorage.getItem(k); if (v != null) d[k] = v; } catch (e) {} }
    return d;
  }

  async function rpc(fn, args) {
    if (!ready) throw new Error('DESLIGADO');
    let r;
    try {
      r = await fetch(`${base}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        // chaves novas (sb_publishable_...) vão só no apikey; as antigas (JWT) também no Authorization
        headers: Object.assign({ apikey: cfg.key, 'Content-Type': 'application/json' }, /^eyJ/.test(cfg.key) ? { Authorization: 'Bearer ' + cfg.key } : {}),
        body: JSON.stringify(args)
      });
    } catch (e) { throw new Error('SEM_CONEXAO'); }
    const txt = await r.text();
    let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) {}
    if (!r.ok) {
      const msg = (data && data.message) || 'ERRO';
      if (msg === 'SESSAO_INVALIDA') { LS.set('conta', null); LS.set('enviado', null); emit(); }
      throw new Error(msg);
    }
    return data;
  }

  const listeners = [];
  const emit = () => listeners.forEach(f => { try { f(session()); } catch (e) {} });
  const session = () => (ready && LS.get('conta')) || null;

  // Junta nuvem e aparelho: em cada jogo fica o lado com a maior pontuação.
  async function puxar() {
    const s = session(); if (!s) return;
    const r = await rpc('carregar', { p_token: s.token });
    const enviado = {};
    for (const [id, g] of Object.entries(GAMES)) {
      const c = r && r.jogos && r.jogos[id];
      if (!c || !c.dados || !Object.keys(c.dados).length) continue;
      const local = localData(id);
      if (g.pontos(c.dados) >= g.pontos(local)) {
        for (const [k, v] of Object.entries(c.dados)) {
          if (g.keys.includes(k) && typeof v === 'string') { try { localStorage.setItem(k, v); } catch (e) {} }
        }
        enviado[id] = JSON.stringify(localData(id));
      }
    }
    LS.set('enviado', enviado);
  }

  // Manda para a nuvem só o que mudou desde o último envio.
  async function enviar() {
    const s = session(); if (!s) return;
    const enviado = LS.get('enviado') || {};
    for (const [id, g] of Object.entries(GAMES)) {
      const d = localData(id);
      if (!Object.keys(d).length) continue;
      const js = JSON.stringify(d);
      if (enviado[id] === js) continue;
      await rpc('salvar', { p_token: s.token, p_jogo: id, p_dados: d, p_pontos: g.rank === false ? 0 : g.pontos(d) });
      enviado[id] = js; LS.set('enviado', enviado);
    }
  }

  let syncing = null;
  function sync() {
    if (!session()) return Promise.resolve(false);
    if (syncing) return syncing;
    syncing = enviar().then(() => true).catch(() => false).finally(() => { syncing = null; });
    return syncing;
  }

  async function entrar(nick, pin) {
    const r = await rpc('entrar', { p_nick: String(nick).trim(), p_pin: String(pin).trim() });
    if (!r || r.erro) throw new Error((r && r.erro) || 'ERRO');
    LS.set('conta', { nick: r.nick, token: r.token });
    LS.set('enviado', null);
    await puxar();
    await enviar();
    emit();
    return r;
  }

  async function sair() {
    const s = session();
    LS.set('conta', null); LS.set('enviado', null); emit();
    if (s) { try { await rpc('sair', { p_token: s.token }); } catch (e) {} }
  }

  const ranking = (jogo, limite = 20) => rpc('ranking', { p_jogo: jogo, p_limite: limite });
  const minhaPosicao = jogo => { const s = session(); return s ? rpc('minha_posicao', { p_token: s.token, p_jogo: jogo }) : Promise.resolve(null); };

  const ERROS = {
    NICK_INVALIDO: 'O nick precisa ter de 3 a 16 caracteres: letras, números ou _ (sem espaço nem acento).',
    PIN_INVALIDO: 'O PIN precisa ter de 4 a 8 números.',
    PIN_ERRADO: 'PIN errado para esse nick. Se esse nick não é seu, escolha outro.',
    BLOQUEADO: 'Muitas tentativas erradas nesse nick. Tente de novo daqui a 10 minutos.',
    SEM_CONEXAO: 'Não consegui falar com o servidor. Confira a internet e tente de novo.'
  };
  const mensagem = e => ERROS[e && e.message] || 'Algo deu errado no servidor. Tente de novo daqui a pouco.';

  window.Cloud = { ready, GAMES, session, entrar, sair, sync, puxar, ranking, minhaPosicao, mensagem, onChange: f => listeners.push(f) };
})();
