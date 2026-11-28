// "Seu dia no Fliperama": Jogo do dia, missões diárias, sequência de dias (🔥) e nível com XP.
// Tudo fica salvo neste navegador (fliperama.engaja). O tempo só conta com a aba visível e um jogo aberto.
(function () {
  'use strict';
  const games = window.GAMES || [];
  if (!games.length) return;
  const KEY = 'fliperama.engaja';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(E)); } catch (e) {} };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const say = (m, ms) => (typeof window.toast === 'function' ? window.toast(m, ms) : null);

  const hoje = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const ontem = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

  // o Jogo do dia é o mesmo para todo mundo naquele dia
  const jogoDoDia = () => games[hashStr('fliper' + hoje()) % games.length];

  let E = load();
  E.xp = E.xp || 0; E.streak = E.streak || 0;
  function dia() {
    if (!E.dia || E.dia.data !== hoje()) E.dia = { data: hoje(), jogos: {}, total: 0, feitas: [] };
    return E.dia;
  }

  const MISSOES = [
    { id: 'dia',  txt: () => `Jogue ${jogoDoDia().title} por 2 min`, xp: 40, ok: d => (d.jogos[jogoDoDia().id] || 0) >= 120, prog: d => Math.min(1, (d.jogos[jogoDoDia().id] || 0) / 120) },
    { id: 'tres', txt: () => 'Jogue 3 jogos diferentes', xp: 30, ok: d => Object.values(d.jogos).filter(s => s >= 30).length >= 3, prog: d => Math.min(1, Object.values(d.jogos).filter(s => s >= 30).length / 3) },
    { id: 'dez',  txt: () => 'Jogue 10 minutos no total', xp: 30, ok: d => d.total >= 600, prog: d => Math.min(1, d.total / 600) }
  ];
  const BONUS = 50;

  // nível: do nível n para o n+1 precisa de 100 + 50·(n-1) XP
  function nivel(xp) { let n = 1, need = 100; while (xp >= need) { xp -= need; n++; need = 100 + 50 * (n - 1); } return { n, xp, need }; }

  function ganhar(xp, msg) {
    const antes = nivel(E.xp).n;
    E.xp += xp;
    const agora = nivel(E.xp).n;
    say(agora > antes ? `🎉 Subiu para o nível ${agora}! (${msg})` : `✅ ${msg} +${xp} XP`, 3500);
  }

  function marcarDiaJogado() {
    const d = dia();
    if (d.contou) return;
    d.contou = true;
    E.streak = E.ultimoDia === ontem() ? E.streak + 1 : (E.ultimoDia === hoje() ? E.streak : 1);
    E.ultimoDia = hoje();
    E.recorde = Math.max(E.recorde || 0, E.streak);
    if (E.streak > 1) say(`🔥 ${E.streak} dias seguidos jogando!`, 3200);
  }

  function checar() {
    const d = dia();
    for (const m of MISSOES) if (!d.feitas.includes(m.id) && m.ok(d)) { d.feitas.push(m.id); ganhar(m.xp, 'Missão: ' + m.txt()); }
    if (d.feitas.length === MISSOES.length && !d.bonus) { d.bonus = true; ganhar(BONUS + Math.min(E.streak, 10) * 5, 'Todas as missões do dia'); }
  }

  // ---------- contador de tempo de jogo ----------
  let atual = null;
  const idDaRota = () => { const id = decodeURIComponent(location.hash.slice(1)); return games.some(g => g.id === id) ? id : null; };
  addEventListener('hashchange', () => { atual = idDaRota(); });
  atual = idDaRota();
  setInterval(() => {
    if (!atual || document.hidden) return;
    const d = dia();
    d.jogos[atual] = (d.jogos[atual] || 0) + 5;
    d.total += 5;
    if (d.total >= 60) marcarDiaJogado();
    checar(); save(); render();
  }, 5000);

  // ---------- painel "Seu dia" no menu lateral ----------
  const side = document.querySelector('.side');
  if (!side) return;
  const box = document.createElement('section');
  box.className = 'shelf hoje'; box.id = 'hoje';
  side.prepend(box);

  function render() {
    const d = dia(), g = jogoDoDia(), lv = nivel(E.xp);
    const streakVivo = E.ultimoDia === hoje() || E.ultimoDia === ontem();
    const st = streakVivo ? E.streak : 0;
    box.innerHTML = `
      <h2 class="section-title">Seu dia</h2>
      <div class="hoje-top">
        <div class="lv" title="Seu nível no Fliperama"><b>Nv ${lv.n}</b><i><u style="width:${Math.round(lv.xp / lv.need * 100)}%"></u></i><small>${lv.xp}/${lv.need} XP</small></div>
        <div class="fogo${st ? ' on' : ''}" title="Dias seguidos jogando">🔥 <b>${st}</b><small>${st === 1 ? 'dia' : 'dias'}</small></div>
      </div>
      <a class="jdd" href="#${encodeURIComponent(g.id)}" style="--c:${esc(g.color || '#ff3e9a')}">
        <span class="jdd-tag">⭐ Jogo do dia</span>
        <span class="jdd-emo" aria-hidden="true">${esc(g.emoji || '🎮')}</span>
        <span class="jdd-t">${esc(g.title)}</span>
        <span class="jdd-go">Jogar ▶</span>
      </a>
      <ul class="miss">
        ${MISSOES.map(m => { const ok = d.feitas.includes(m.id); return `<li class="${ok ? 'ok' : ''}"><span class="ck" aria-hidden="true">${ok ? '✔' : ''}</span><span class="mt">${esc(m.txt())}<i><u style="width:${Math.round(m.prog(d) * 100)}%"></u></i></span><small>+${m.xp}</small></li>`; }).join('')}
      </ul>
      <p class="miss-foot">${d.bonus ? '🏅 Missões completas! Volte amanhã para manter o 🔥.' : `Complete as 3 e ganhe +${BONUS + Math.min(E.streak, 10) * 5} XP de bônus.`}</p>`;
  }
  render();
  // marca o Jogo do dia nos cards da lista
  function marcarCards() {
    const id = jogoDoDia().id;
    document.querySelectorAll('.card').forEach(c => {
      const a = c.querySelector(`a[href="#${CSS.escape(encodeURIComponent(id))}"]`) || (c.matches(`a[href="#${CSS.escape(encodeURIComponent(id))}"]`) ? c : null);
      c.classList.toggle('is-jdd', !!a);
    });
  }
  const grid = document.getElementById('grid');
  if (grid) new MutationObserver(marcarCards).observe(grid, { childList: true });
  marcarCards();
  window.Engaja = { get estado() { return E; }, render };
})();
