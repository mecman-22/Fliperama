/* =========================================================
   BLOOMBLAST — protótipo (nome provisório)
   Jogo de bombas em grade com tema de jardim relaxante.
   Modos: Aventura (1 jogador) e Batalha (2–4, humanos + bots).
   HTML5 Canvas puro, sem dependências. Gráficos desenhados
   em código e sons sintetizados.
   ========================================================= */
'use strict';

// ---------- Configuração ----------
const COLS = 15, ROWS = 13, T = 48, HUD = 68, N = COLS * ROWS;
const W = COLS * T, H = ROWS * T + HUD;
const FUSE = 2.6, FLAME_DUR = 0.6, INF = 1e9;
const BASE_SPEED = 3.4, SPEED_STEP = 0.45;
const PH = 0.38; // meia-largura da caixa de colisão do jogador (em tiles)
const ROUND_TIME = 120, DROP_EVERY = 0.32, DROP_FALL = 0.3;
const FONT = 'Fredoka, "Baloo 2", "Nunito", system-ui, sans-serif';

const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
const DIRV = Object.values(DIRS);
const BIT = { left: 1, right: 2, up: 4, down: 8 };
const OPP = { left: 'right', right: 'left', up: 'down', down: 'up' };
const SPAWNS = [[1, 1], [13, 11], [13, 1], [1, 11]];

const PAL = {
  grassA: '#bfe6ab', grassB: '#b2dd9e', tuft: '#9fd08b',
  stoneTop: '#ddd6ee', stoneSide: '#aca2c8', stoneLine: '#c4bbdc',
  borderTop: '#c9c0e0', borderSide: '#9286b6',
  bush: '#5cae6a', bushDark: '#478f57', bushLight: '#86cb86',
  flowers: ['#ff9ec4', '#ffd56b', '#ffffff', '#c9a7ff', '#ff9b8f'],
  ink: '#4b3b5c', cream: '#fffaf2'
};
// cores de cada jogador
const PCOL = [
  { body: '#fff3e0', shade: '#ffe4c4', ear: '#ffc2d0', feet: '#ffd3a8', tag: '#ff7fa6', tint: '#ffe3ef' },
  { body: '#e9fbf2', shade: '#b4ead0', ear: '#ffd1a8', feet: '#93d8b8', tag: '#2fa596', tint: '#d6f3ee' },
  { body: '#f3edff', shade: '#d3c2ff', ear: '#ffc2e0', feet: '#bba6ee', tag: '#8d6be0', tint: '#ebe2ff' },
  { body: '#eaf4ff', shade: '#a9cdf5', ear: '#ffc2d0', feet: '#8db8ea', tag: '#4f8fd6', tint: '#dcebff' }
];

const ENEMY = {
  slime:  { speed: 1.5, score: 100, chase: 0, ghost: false },
  beetle: { speed: 2.3, score: 200, chase: 6, ghost: false },
  wisp:   { speed: 1.25, score: 300, chase: 5, ghost: true }
};
const VARIANT = {
  classic: { name: 'Clássico', desc: 'Só os itens básicos: bomba, alcance e velocidade' },
  party:   { name: 'Festa',    desc: 'Itens extras: chutar bomba, luva para arremessar e escudo' }
};
const KICK_SPEED = 8;
const newStats = () => ({ bombs: 1, range: 2, speedUps: 0, kick: false, glove: false, shield: false });
const DIFF = {
  easy:   { name: 'Fácil',   react: 0.5,  interval: 1.3, aggr: 0.25 },
  normal: { name: 'Normal',  react: 0.26, interval: 0.9, aggr: 0.55 },
  hard:   { name: 'Difícil', react: 0.1,  interval: 0.5, aggr: 0.9 }
};

// ---------- Utilidades ----------
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const key = (x, y) => x + ',' + y;
const fl = Math.floor;
function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function rrect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `rgb(${r},${g},${bl})`;
}
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

// ---------- Canvas ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let DPR = 1, groundCanvas = null;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * DPR; canvas.height = H * DPR;
  const s = Math.min((window.innerWidth - 16) / W, (window.innerHeight - 16) / H);
  canvas.style.width = Math.floor(W * s) + 'px';
  canvas.style.height = Math.floor(H * s) + 'px';
  if (L) bakeGround();
}
window.addEventListener('resize', resize);

// ---------- Áudio (sintetizado) ----------
const Sound = {
  c: null, sfx: null, music: null, musicOn: store('bb_music') !== '0', timer: null, step: 0, next: 0,
  init() {
    if (this.c) { if (this.c.state === 'suspended') this.c.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.c = new AC();
    const master = c.createGain(); master.gain.value = 0.85; master.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.6; this.sfx.connect(master);
    this.music = c.createGain(); this.music.gain.value = this.musicOn ? 0.2 : 0; this.music.connect(master);
    const d = c.createDelay(); d.delayTime.value = 0.36;
    const fb = c.createGain(); fb.gain.value = 0.38; const wet = c.createGain(); wet.gain.value = 0.45;
    d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(master);
    this.music.connect(d); this.sfx.connect(d);
    this.next = c.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 90);
  },
  toggleMusic() {
    this.musicOn = !this.musicOn; store('bb_music', this.musicOn ? '1' : '0');
    if (this.music) this.music.gain.setTargetAtTime(this.musicOn ? 0.2 : 0, this.c.currentTime, 0.2);
  },
  tone(f, dur, o = {}) {
    const c = this.c; if (!c) return;
    const t = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + (o.attack || 0.012));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(o.dest || this.sfx); osc.start(t); osc.stop(t + dur + 0.05);
  },
  noise(dur, vol, freq) {
    const c = this.c; if (!c) return;
    const len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq, c.currentTime);
    f.frequency.exponentialRampToValueAtTime(80, c.currentTime + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(this.sfx); src.start();
  },
  place() { this.tone(520, 0.14, { vol: 0.22, slide: 320 }); },
  boom() { this.noise(0.55, 0.45, 1400); this.tone(120, 0.45, { vol: 0.3, slide: 45 }); },
  bush() { this.noise(0.18, 0.12, 3200); },
  thud() { this.noise(0.25, 0.25, 600); this.tone(90, 0.25, { vol: 0.2, slide: 50 }); },
  pickup() { [660, 880, 1320].forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', vol: 0.16, delay: i * 0.07 })); },
  enemy() { this.tone(700, 0.2, { vol: 0.14, slide: 1400 }); this.tone(1050, 0.25, { type: 'triangle', vol: 0.08, delay: 0.06 }); },
  die() { this.tone(640, 0.8, { type: 'triangle', vol: 0.2, slide: 140 }); },
  menu() { this.tone(880, 0.08, { type: 'triangle', vol: 0.08 }); },
  go() { [523, 784].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.14, delay: i * 0.12 })); },
  hurry() { [988, 784, 988, 784].forEach((f, i) => this.tone(f, 0.16, { type: 'square', vol: 0.05, delay: i * 0.16 })); },
  portal() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.5, { type: 'sine', vol: 0.12, delay: i * 0.1 })); },
  clear() { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.15, delay: i * 0.11 })); },
  // música ambiente generativa (pentatônica, acordes suaves)
  schedule() {
    const c = this.c; if (!c) return;
    const midi = n => 440 * Math.pow(2, (n - 69) / 12);
    const chords = [[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 55, 59]];
    const STEP = 0.32;
    while (this.next < c.currentTime + 0.4) {
      const t = this.next - c.currentTime, s = this.step, ch = chords[Math.floor(s / 8) % 4];
      if (s % 8 === 0) {
        ch.forEach(n => this.tone(midi(n + 12), 2.6, { vol: 0.035, attack: 0.6, delay: t, dest: this.music }));
        this.tone(midi(ch[0] - 12), 1.4, { vol: 0.09, attack: 0.05, delay: t, dest: this.music });
      }
      if (s % 8 === 4) this.tone(midi(ch[0] - 12), 1.0, { vol: 0.06, delay: t, dest: this.music });
      if (Math.random() < 0.55) {
        const pent = [0, 2, 4, 7, 9], n = 72 + pick(pent) + (Math.random() < 0.3 ? 12 : 0);
        this.tone(midi(n), 0.5, { type: 'triangle', vol: 0.03, delay: t, dest: this.music });
      }
      this.next += STEP; this.step++;
    }
  }
};

// ---------- Configurações salvas ----------
const settings = Object.assign({ humans: 1, bots: 3, diff: 'normal', wins: 3, variant: 'classic' }, (() => { try { return JSON.parse(store('bb_settings') || '{}'); } catch (e) { return {}; } })());
const saveSettings = () => store('bb_settings', JSON.stringify(settings));

// ---------- Entrada ----------
// J1: WASD + Espaço/F  ·  J2: Setas + Enter/Shift direito  ·  controles: distribuídos automaticamente
const Input = { kb: [[], []], kbBomb: [false, false], touchDir: null, touchBomb: false, pads: [], padPrev: {}, nav: [], confirm: false, back: false, pause: false, clicks: [] };
const KB = [{ KeyW: 'up', KeyA: 'left', KeyS: 'down', KeyD: 'right' }, { ArrowUp: 'up', ArrowLeft: 'left', ArrowDown: 'down', ArrowRight: 'right' }];
const BOMBK = [['Space', 'KeyF', 'KeyX'], ['Enter', 'NumpadEnter', 'Numpad0', 'ShiftRight', 'ControlRight', 'Slash']];
window.addEventListener('keydown', e => {
  Sound.init();
  for (let s = 0; s < 2; s++) {
    const d = KB[s][e.code];
    if (d) { if (!Input.kb[s].includes(d)) Input.kb[s].push(d); if (!e.repeat) Input.nav.push(d); e.preventDefault(); }
  }
  if (e.repeat) return;
  if (BOMBK[0].includes(e.code)) Input.kbBomb[0] = true;
  if (BOMBK[1].includes(e.code)) Input.kbBomb[1] = true;
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') { Input.confirm = true; e.preventDefault(); }
  if (e.code === 'Escape') { Input.back = true; Input.pause = true; }
  if (e.code === 'KeyP') Input.pause = true;
  if (e.code === 'KeyM') Sound.toggleMusic();
});
window.addEventListener('keyup', e => { for (let s = 0; s < 2; s++) { const d = KB[s][e.code]; if (d) Input.kb[s] = Input.kb[s].filter(x => x !== d); } });
window.addEventListener('blur', () => { Input.kb = [[], []]; if (state === 'play') openPause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') openPause(); });

const isTouch = ('ontouchstart' in window) || matchMedia('(pointer: coarse)').matches;
if (isTouch) document.body.classList.add('touch');
(function setupTouch() {
  const pad = document.getElementById('dpad'), knob = document.getElementById('knob');
  const bomb = document.getElementById('bombBtn'), pause = document.getElementById('pauseBtn');
  let pid = null;
  const upd = e => {
    const r = pad.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const m = Math.hypot(dx, dy), lim = r.width * 0.32, k = Math.min(1, lim / (m || 1));
    knob.style.transform = `translate(${dx * k}px,${dy * k}px)`;
    Input.touchDir = m < 14 ? null : Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
  };
  pad.addEventListener('pointerdown', e => { Sound.init(); pid = e.pointerId; pad.setPointerCapture(pid); upd(e); });
  pad.addEventListener('pointermove', e => { if (e.pointerId === pid) upd(e); });
  const end = e => { if (e.pointerId !== pid) return; pid = null; Input.touchDir = null; knob.style.transform = ''; };
  pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
  bomb.addEventListener('pointerdown', e => { Sound.init(); bomb.classList.add('down'); Input.touchBomb = true; Input.confirm = true; e.preventDefault(); });
  bomb.addEventListener('pointerup', () => bomb.classList.remove('down'));
  pause.addEventListener('pointerdown', e => { Input.pause = true; e.preventDefault(); });
  canvas.addEventListener('pointerdown', e => {
    Sound.init();
    const r = canvas.getBoundingClientRect();
    Input.clicks.push([(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]);
  });
})();
function pollPads() {
  const list = [];
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of pads) {
    if (!gp || !gp.connected) continue;
    const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    let dir = null;
    if (b(14) || ax < -0.45) dir = 'left'; else if (b(15) || ax > 0.45) dir = 'right';
    else if (b(12) || ay < -0.45) dir = 'up'; else if (b(13) || ay > 0.45) dir = 'down';
    const prev = Input.padPrev[gp.index] || {};
    const now = { a: b(0) || b(2), start: b(9), back: b(1), dir };
    let bomb = false;
    if (now.a && !prev.a) { bomb = true; Input.confirm = true; Sound.init(); }
    if (now.start && !prev.start) Input.pause = true;
    if (now.back && !prev.back) Input.back = true;
    if (dir && dir !== prev.dir) Input.nav.push(dir);
    Input.padPrev[gp.index] = now;
    list.push({ dir, bomb });
  }
  Input.pads = list;
}
// Decide de onde vêm os comandos do jogador humano i
function humanControl(i) {
  const n = mode === 'adv' ? 1 : settings.humans, pads = Input.pads, k = pads.length;
  let pad = null;
  if (k >= n) pad = pads[i]; else if (i >= n - k) pad = pads[i - (n - k)];
  const kbs = n === 1 ? [0, 1] : (i < 2 ? [i] : []);
  let dir = (i === 0 && Input.touchDir) || (pad && pad.dir) || null;
  for (const s of kbs) if (!dir && Input.kb[s].length) dir = Input.kb[s][Input.kb[s].length - 1];
  const bomb = kbs.some(s => Input.kbBomb[s]) || !!(pad && pad.bomb) || (i === 0 && Input.touchBomb);
  return { dir, bomb };
}

// ---------- Estado ----------
let state = 'title'; // title | setup | play | pause | dead | clear | over | round | match
let mode = null;     // null (demo) | 'adv' | 'battle'
let G = null, B = null, L = null, players = [], menu = null;
let time = 0, shake = 0, stateT = 0, pausedFrom = 'play';
let best = parseInt(store('bb_best') || '0', 10) || 0;
const P0 = () => players[0];
const speedOf = p => BASE_SPEED + p.st.speedUps * SPEED_STEP;
const playerName = p => p.human ? 'J' + (p.id + 1) : 'CPU ' + (p.id - settings.humans + 1);

function makePlayer(id, x, y, o) {
  return { id, x: x + 0.5, y: y + 0.5, dir: 'down', alive: true, deathT: 0, pass: new Set(), anim: 0, inv: o.inv || 0,
    moving: false, active: 0, blink: rand(1, 4), st: o.st, human: o.human,
    bot: o.human ? null : { path: [], react: INF, timer: rand(0.2, 0.6), idle: 0, seen: 0 } };
}

function makeLevel(o) {
  const grid = [];
  for (let y = 0; y < ROWS; y++) {
    grid.push([]);
    for (let x = 0; x < COLS; x++) {
      const border = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
      grid[y].push(border || (x % 2 === 0 && y % 2 === 0) ? 1 : 0);
    }
  }
  const safe = (x, y) => o.spawns.some(([sx, sy]) => Math.abs(x - sx) + Math.abs(y - sy) <= 1);
  const bushes = [];
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++)
    if (grid[y][x] === 0 && !safe(x, y) && Math.random() < o.density) { grid[y][x] = 2; bushes.push([x, y]); }
  let exit = null;
  if (o.exit) {
    const far = bushes.filter(([x, y]) => x + y > 10);
    const [ex, ey] = pick(far.length ? far : bushes);
    exit = { x: ex, y: ey, revealed: false, open: false, t: 0 };
  }
  return { grid, bombs: [], flames: new Map(), burning: [], powerups: [], enemies: [], parts: [], texts: [],
    exit, intro: o.intro || 0, age: 0, bombVer: 0, stones: [], falling: [], dropList: null, dropT: 0,
    timeLeft: o.time || 0, banner: null, endT: 0 };
}

function spawnEnemies(n, lv, demo) {
  const spots = [];
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) if (L.grid[y][x] === 0 && x + y >= 7) spots.push([x, y]);
  for (let i = 0; i < n && spots.length; i++) {
    const [sx, sy] = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
    let type = 'slime'; const r = Math.random();
    if ((lv >= 3 || demo) && r < 0.18 + lv * 0.02) type = 'wisp';
    else if ((lv >= 2 || demo) && r < 0.55) type = 'beetle';
    L.enemies.push({ type, x: sx + 0.5, y: sy + 0.5, fx: sx, fy: sy, tx: sx, ty: sy, dir: pick(Object.keys(DIRS)), alive: true, dieT: 0, anim: Math.random() * 10 });
  }
}

// --- Modos ---
function startDemo() {
  mode = null; players = [];
  L = makeLevel({ spawns: [[1, 1]], density: 0.5 });
  spawnEnemies(5, 3, true);
  bakeGround();
}
function startAdventure() {
  mode = 'adv'; menu = null;
  G = { level: 1, score: 0, lives: 3, bombs: 1, range: 2, speedUps: 0 };
  buildAdvLevel(); state = 'play';
}
function buildAdvLevel() {
  L = makeLevel({ spawns: [[1, 1]], density: 0.48 + Math.min(G.level * 0.02, 0.16), exit: true, intro: 2 });
  spawnEnemies(Math.min(2 + G.level, 10), G.level, false);
  players = [makePlayer(0, 1, 1, { human: true, st: G, inv: 2 })];
  bakeGround();
}
function startBattle() {
  mode = 'battle'; menu = null;
  const n = settings.humans + settings.bots;
  B = { round: 0, wins: Array(n).fill(0), n, winner: -1 };
  nextRound();
}
function nextRound() {
  B.round++;
  L = makeLevel({ spawns: SPAWNS.slice(0, B.n), density: 0.66, intro: 2.2, time: ROUND_TIME });
  players = [];
  for (let i = 0; i < B.n; i++) players.push(makePlayer(i, SPAWNS[i][0], SPAWNS[i][1], { human: i < settings.humans, st: newStats() }));
  state = 'play'; stateT = 0;
  bakeGround();
}

// --- Menus ---
function setMenu(items, extra = {}) { menu = Object.assign({ items, sel: 0, rects: [], lock: 0 }, extra); }
function goTitle() {
  state = 'title'; stateT = 0; startDemo();
  setMenu([
    { label: 'Aventura', act: startAdventure },
    { label: 'Batalha  ·  2 a 4 jogadores', act: goSetup }
  ]);
}
function goSetup() {
  state = 'setup';
  const fixBots = () => {
    settings.bots = clamp(settings.bots, settings.humans >= 2 ? 0 : 1, 4 - settings.humans);
  };
  setMenu([
    { label: 'Modo', get: () => VARIANT[settings.variant].name, change: () => { settings.variant = settings.variant === 'classic' ? 'party' : 'classic'; } },
    { label: 'Jogadores humanos', get: () => settings.humans, change: d => { settings.humans = clamp(settings.humans + d, 1, 4); fixBots(); } },
    { label: 'Bots (CPU)', get: () => settings.bots, change: d => { settings.bots += d; fixBots(); } },
    { label: 'Dificuldade dos bots', get: () => DIFF[settings.diff].name, change: d => { const k = Object.keys(DIFF); settings.diff = k[(k.indexOf(settings.diff) + d + k.length) % k.length]; } },
    { label: 'Vitórias para vencer', get: () => settings.wins, change: d => { settings.wins = clamp(settings.wins + d, 1, 5); } },
    { label: 'Começar!', act: () => { saveSettings(); startBattle(); }, accent: true },
    { label: 'Voltar', act: () => { saveSettings(); goTitle(); } }
  ], { onBack: () => { saveSettings(); goTitle(); }, sel: 5 });
}
function openPause() {
  if (state !== 'play') return;
  pausedFrom = state; state = 'pause';
  setMenu([{ label: 'Continuar', act: resume }, { label: 'Sair para o menu', act: goTitle }], { onBack: resume });
}
function resume() { state = pausedFrom; menu = null; }

function handleMenu(dt) {
  if (!menu) return;
  if (menu.lock > 0) { menu.lock -= dt; return; }
  const items = menu.items, move = d => {
    let i = menu.sel;
    i = (i + d + items.length) % items.length; menu.sel = i; Sound.menu();
  };
  for (const n of Input.nav) {
    if (n === 'up') move(-1); else if (n === 'down') move(1);
    else if (items[menu.sel].change) { items[menu.sel].change(n === 'left' ? -1 : 1); Sound.menu(); }
  }
  for (const [mx, my] of Input.clicks) {
    menu.rects.forEach((r, i) => {
      if (mx < r.x || mx > r.x + r.w || my < r.y || my > r.y + r.h) return;
      menu.sel = i; const it = items[i];
      if (it.change) {
        if (mx < r.la - 22) { Sound.menu(); return; } // clique no texto: só seleciona
        it.change(mx < (r.la + r.ra) / 2 ? -1 : 1); Sound.menu();
      } else if (it.act) { Sound.go(); it.act(); }
    });
    if (menu !== null && menu.items !== items) return;
  }
  if (Input.confirm) { const it = items[menu.sel]; if (it.act) { Sound.go(); it.act(); } else if (it.change) it.change(1); return; }
  if (Input.back && menu.onBack) menu.onBack();
}

// ---------- Consultas de mapa ----------
const inside = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
const bombAt = (x, y, skip) => L.bombs.find(b => b.x === x && b.y === y && !b.air && b !== skip);
const isBurning = (x, y) => L.burning.some(b => b.x === x && b.y === y);
function solidFor(p, tx, ty) {
  if (!inside(tx, ty) || L.grid[ty][tx] !== 0) return true;
  const b = bombAt(tx, ty); return !!(b && !p.pass.has(b));
}
function boxFree(p, x, y) {
  const x0 = fl(x - PH), x1 = fl(x + PH - 1e-6), y0 = fl(y - PH), y1 = fl(y + PH - 1e-6);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solidFor(p, tx, ty)) return false;
  return true;
}
function overlapsTile(x, y, tx, ty) { return x + PH > tx && x - PH < tx + 1 && y + PH > ty && y - PH < ty + 1; }
function enemyFree(tx, ty, e) {
  if (!inside(tx, ty)) return false;
  const g = L.grid[ty][tx];
  if (g === 1 || (g === 2 && !ENEMY[e.type].ghost)) return false;
  return !bombAt(tx, ty);
}

// ---------- Partículas ----------
function burst(x, y, n, kind, colors, spd = 90) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = rand(spd * 0.3, spd);
    L.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (kind === 'petal' ? 30 : 0), life: 0, max: rand(0.6, 1.3),
      kind, color: pick(colors), rot: Math.random() * 6, vr: rand(-6, 6), size: rand(3, 6) });
  }
}
function floatText(x, y, text, color = '#fff') { L.texts.push({ x, y, text, color, t: 0 }); }

// ---------- Bombas e explosões ----------
function placeBomb(p) {
  if (!p.alive || p.active >= p.st.bombs) return false;
  const tx = fl(p.x), ty = fl(p.y);
  if (bombAt(tx, ty) || L.grid[ty][tx] !== 0) return false;
  const b = { x: tx, y: ty, px: tx + 0.5, py: ty + 0.5, h: 0, t: 0, fuse: FUSE, range: p.st.range, owner: p, slide: null, air: null };
  L.bombs.push(b); p.active++; L.bombVer++;
  for (const q of players) if (q.alive && overlapsTile(q.x, q.y, tx, ty)) q.pass.add(b);
  Sound.place();
  return true;
}
function removeBomb(b) {
  const i = L.bombs.indexOf(b); if (i < 0) return;
  L.bombs.splice(i, 1);
  for (const q of players) q.pass.delete(b);
  if (b.owner) b.owner.active = Math.max(0, b.owner.active - 1);
  L.bombVer++;
}
// --- Modo Festa: chutar e arremessar ---
function tileHasCreature(x, y) {
  return players.some(q => q.alive && overlapsTile(q.x, q.y, x, y)) || L.enemies.some(e => e.alive && fl(e.x) === x && fl(e.y) === y);
}
function slideFree(b, x, y) {
  return inside(x, y) && L.grid[y][x] === 0 && !bombAt(x, y, b) && !tileHasCreature(x, y);
}
function tryKick(p, dx, dy) {
  if (!p.st.kick) return false;
  const cx = fl(p.x), cy = fl(p.y);
  if (dx && Math.abs(p.y - cy - 0.5) > 0.25) return false;
  if (dy && Math.abs(p.x - cx - 0.5) > 0.25) return false;
  const b = bombAt(cx + dx, cy + dy);
  if (!b || b.slide || p.pass.has(b) || !slideFree(b, b.x + dx, b.y + dy)) return false;
  b.slide = { dx, dy }; L.bombVer++;
  Sound.tone(300, 0.12, { type: 'triangle', vol: 0.18, slide: 600 });
  burst(b.px * T, HUD + b.py * T + 10, 5, 'puff', ['#ffffff', '#efe6ff'], 60);
  return true;
}
function throwBomb(p, b) {
  const [dx, dy] = DIRS[p.dir];
  let x = b.x + dx * 3, y = b.y + dy * 3, guard = 0;
  const wrap = () => { if (x < 1) x = COLS - 2; if (x > COLS - 2) x = 1; if (y < 1) y = ROWS - 2; if (y > ROWS - 2) y = 1; };
  wrap();
  while (guard++ < 40 && !(L.grid[y][x] === 0 && !bombAt(x, y, b) && !tileHasCreature(x, y))) { x += dx; y += dy; wrap(); }
  for (const q of players) q.pass.delete(b);
  const dist = Math.abs(x - b.x) + Math.abs(y - b.y);
  b.air = { fx: b.px, fy: b.py, t: 0, dur: 0.3 + dist * 0.04 };
  b.x = x; b.y = y; b.slide = null; b.t = Math.min(b.t, b.fuse - 0.9);
  L.bombVer++;
  Sound.tone(420, 0.25, { type: 'sine', vol: 0.16, slide: 900 });
}
function updateBomb(b, dt) {
  if (b.air) {
    const a = b.air; a.t += dt; const k = Math.min(1, a.t / a.dur);
    b.px = a.fx + (b.x + 0.5 - a.fx) * k; b.py = a.fy + (b.y + 0.5 - a.fy) * k; b.h = Math.sin(Math.PI * k) * (0.9 + a.dur);
    if (k >= 1) {
      b.air = null; b.h = 0; L.bombVer++; Sound.thud();
      burst(b.px * T, HUD + b.py * T + 12, 6, 'puff', ['#ffffff', '#e6def2'], 60);
      for (const q of players) if (q.alive && overlapsTile(q.x, q.y, b.x, b.y)) q.pass.add(b);
    }
    return;
  }
  b.t += dt;
  if (b.slide) {
    const { dx, dy } = b.slide, nx = b.x + dx, ny = b.y + dy;
    const past = dx ? (b.px - b.x - 0.5) * dx >= 0 : (b.py - b.y - 0.5) * dy >= 0;
    if (past && !slideFree(b, nx, ny)) { b.px = b.x + 0.5; b.py = b.y + 0.5; b.slide = null; L.bombVer++; Sound.thud(); }
    else {
      b.px += dx * KICK_SPEED * dt; b.py += dy * KICK_SPEED * dt;
      if (Math.abs(b.px - b.x - 0.5) >= 0.5 || Math.abs(b.py - b.y - 0.5) >= 0.5) {
        if (slideFree(b, nx, ny)) { b.x = nx; b.y = ny; }
        else { b.px = b.x + 0.5; b.py = b.y + 0.5; b.slide = null; L.bombVer++; Sound.thud(); }
      }
    }
  }
  if (b.t >= b.fuse && L.bombs.includes(b)) explode(b);
}
function addFlame(x, y, mask) {
  const k = key(x, y), f = L.flames.get(k);
  if (f) { f.mask |= mask; f.t = Math.min(f.t, 0.05); } else L.flames.set(k, { x, y, mask, t: 0 });
  if (Math.random() < 0.6) burst(x * T + T / 2, HUD + y * T + T / 2, 2, 'petal', ['#ffc2d6', '#fff3c4', '#ffffff'], 70);
}
function explode(b) {
  removeBomb(b);
  let center = 0;
  for (const d in DIRS) {
    const [dx, dy] = DIRS[d];
    for (let i = 1; i <= b.range; i++) {
      const x = b.x + dx * i, y = b.y + dy * i;
      if (!inside(x, y) || L.grid[y][x] === 1) break;
      if (i === 1) center |= BIT[d];
      if (L.grid[y][x] === 2) { addFlame(x, y, BIT[OPP[d]]); burnBush(x, y); break; }
      const ob = bombAt(x, y);
      if (ob) { ob.t = Math.max(ob.t, ob.fuse - 0.07); addFlame(x, y, BIT[OPP[d]]); break; }
      const pu = L.powerups.find(p => p.x === x && p.y === y && p.protect <= 0);
      if (pu) { L.powerups.splice(L.powerups.indexOf(pu), 1); burst(x * T + T / 2, HUD + y * T + T / 2, 10, 'puff', ['#ffffff', '#f3eaff']); addFlame(x, y, BIT[OPP[d]]); break; }
      let nextOk = false;
      if (i < b.range) { const nx = x + dx, ny = y + dy; nextOk = inside(nx, ny) && L.grid[ny][nx] !== 1; }
      addFlame(x, y, BIT[OPP[d]] | (nextOk ? BIT[d] : 0));
    }
  }
  addFlame(b.x, b.y, center);
  shake = Math.max(shake, 4);
  Sound.boom();
}
function burnBush(x, y) {
  if (isBurning(x, y)) return;
  L.burning.push({ x, y, t: 0 });
  burst(x * T + T / 2, HUD + y * T + T / 2, 8, 'leaf', ['#5cae6a', '#86cb86', '#478f57'], 110);
  burst(x * T + T / 2, HUD + y * T + T / 2, 5, 'petal', PAL.flowers, 90);
  Sound.bush();
}
function rollPowerup(x, y) {
  if (Math.random() > (mode === 'battle' ? 0.38 : 0.3)) return;
  let pool = ['bomb', 'bomb', 'bomb', 'range', 'range', 'range', 'speed', 'speed'];
  if (mode === 'battle' && settings.variant === 'party') pool.push('kick', 'kick', 'glove', 'glove', 'shield');
  if (mode === 'adv' && G.lives < 5 && Math.random() < 0.08) pool = ['life'];
  L.powerups.push({ x, y, type: pick(pool), protect: 0.7, t: 0 });
}
function collect(p, pu) {
  L.powerups.splice(L.powerups.indexOf(pu), 1);
  const cx = pu.x * T + T / 2, cy = HUD + pu.y * T + T / 2;
  let txt = '';
  if (pu.type === 'bomb') { p.st.bombs = Math.min(8, p.st.bombs + 1); txt = '+1 bomba'; }
  if (pu.type === 'range') { p.st.range = Math.min(8, p.st.range + 1); txt = '+1 alcance'; }
  if (pu.type === 'speed') { p.st.speedUps = Math.min(5, p.st.speedUps + 1); txt = '+velocidade'; }
  if (pu.type === 'kick') { p.st.kick = true; txt = 'Chute!'; }
  if (pu.type === 'glove') { p.st.glove = true; txt = 'Luva!'; }
  if (pu.type === 'shield') { p.st.shield = true; txt = 'Escudo!'; }
  if (pu.type === 'life' && G) { G.lives = Math.min(5, G.lives + 1); txt = '+1 vida'; }
  if (mode === 'adv') G.score += 50;
  floatText(cx, cy - 10, txt, '#fff');
  burst(cx, cy, 14, 'spark', ['#fff3a8', '#ffffff', '#ffc2d6'], 120);
  Sound.pickup();
}
function killPlayer(p, force) {
  if (!p.alive || (p.inv > 0 && !force)) return;
  if (!force && p.st.shield) {
    p.st.shield = false; p.inv = 1.5;
    burst(p.x * T, HUD + p.y * T, 16, 'spark', ['#bfe9ff', '#ffffff', '#d9c8ff'], 130);
    Sound.tone(1200, 0.4, { type: 'triangle', vol: 0.15, slide: 500 });
    floatText(p.x * T, HUD + p.y * T - 24, 'Escudo!', '#d9f2ff');
    return;
  }
  p.alive = false; p.deathT = 0;
  burst(p.x * T, HUD + p.y * T, 18, 'petal', [PCOL[p.id].body, '#ffc2d6', '#ffe08a'], 140);
  Sound.die();
  if (mode === 'adv') { state = 'dead'; stateT = 0; }
}
function killEnemy(e) {
  if (!e.alive) return;
  e.alive = false; e.dieT = 0;
  const pts = ENEMY[e.type].score;
  if (mode === 'adv') { G.score += pts; floatText(e.x * T, HUD + e.y * T - 14, '+' + pts, '#fff7b0'); }
  burst(e.x * T, HUD + e.y * T, 14, 'puff', ['#ffffff', '#efe6ff', '#ffe6f0'], 100);
  burst(e.x * T, HUD + e.y * T, 8, 'petal', PAL.flowers, 120);
  Sound.enemy();
}

// ---------- Movimento do jogador humano ----------
function movePlayer(p, d, dt) {
  p.moving = false;
  if (!d) return;
  p.dir = d;
  const [dx, dy] = DIRS[d];
  const dist = speedOf(p) * dt;
  const steps = Math.ceil(dist / 0.08), s = dist / steps;
  for (let i = 0; i < steps; i++) {
    if (dx) {
      if (boxFree(p, p.x + dx * s, p.y)) { p.x += dx * s; p.moving = true; continue; }
      if (tryKick(p, dx, 0)) break;
      const ax = fl(p.x + dx * (PH + s)), lane = fl(p.y) + 0.5, off = lane - p.y;
      if (!solidFor(p, ax, fl(p.y)) && Math.abs(off) > 1e-4) { p.y += Math.sign(off) * Math.min(s, Math.abs(off)); p.moving = true; }
      else if (Math.abs(off) > 0.12) {
        const ol = lane - Math.sign(off);
        if (!solidFor(p, ax, fl(ol)) && !solidFor(p, fl(p.x), fl(ol)) && boxFree(p, p.x, p.y - Math.sign(off) * s)) { p.y -= Math.sign(off) * s; p.moving = true; }
      }
    } else {
      if (boxFree(p, p.x, p.y + dy * s)) { p.y += dy * s; p.moving = true; continue; }
      if (tryKick(p, 0, dy)) break;
      const ay = fl(p.y + dy * (PH + s)), lane = fl(p.x) + 0.5, off = lane - p.x;
      if (!solidFor(p, fl(p.x), ay) && Math.abs(off) > 1e-4) { p.x += Math.sign(off) * Math.min(s, Math.abs(off)); p.moving = true; }
      else if (Math.abs(off) > 0.12) {
        const ol = lane - Math.sign(off);
        if (!solidFor(p, fl(ol), ay) && !solidFor(p, fl(ol), fl(p.y)) && boxFree(p, p.x - Math.sign(off) * s, p.y)) { p.x -= Math.sign(off) * s; p.moving = true; }
      }
    }
  }
}

// ---------- IA dos bots ----------
// Tiles atingidos por uma bomba em (bx,by)
function blastTiles(bx, by, range, isB = (x, y) => !!bombAt(x, y)) {
  const out = [[bx, by]];
  for (const [dx, dy] of DIRV) {
    for (let i = 1; i <= range; i++) {
      const x = bx + dx * i, y = by + dy * i;
      if (!inside(x, y) || L.grid[y][x] === 1) break;
      out.push([x, y]);
      if (L.grid[y][x] === 2 || isB(x, y) || L.powerups.some(p => p.x === x && p.y === y && p.protect <= 0)) break;
    }
  }
  return out;
}
// Mapa de perigo: S = quando o tile será atingido, E = até quando, B = perigo de bomba/pedra
function computeDanger(extra) {
  const S = new Float32Array(N).fill(INF), E = new Float32Array(N).fill(-1), Bd = new Uint8Array(N);
  const bs = L.bombs.map(b => ({ x: b.x, y: b.y, range: b.range, rem: b.fuse - b.t + (b.air ? b.air.dur - b.air.t : 0) }));
  if (extra) bs.push(extra);
  const isB = (x, y) => bs.some(b => b.x === x && b.y === y);
  const blasts = bs.map(b => blastTiles(b.x, b.y, b.range, isB));
  let changed = true, guard = 0;
  while (changed && guard++ < 12) { // reação em cadeia
    changed = false;
    bs.forEach((b, i) => {
      for (const [x, y] of blasts[i]) for (const o of bs)
        if (o !== b && o.x === x && o.y === y && o.rem > b.rem) { o.rem = b.rem; changed = true; }
    });
  }
  bs.forEach((b, i) => {
    for (const [x, y] of blasts[i]) {
      const k = y * COLS + x;
      S[k] = Math.min(S[k], b.rem); E[k] = Math.max(E[k], b.rem + FLAME_DUR); Bd[k] = 1;
    }
  });
  for (const f of L.flames.values()) {
    if (f.t >= FLAME_DUR * 0.85) continue;
    const k = f.y * COLS + f.x; S[k] = 0; E[k] = Math.max(E[k], FLAME_DUR * 0.85 - f.t);
  }
  for (const d of L.falling) { const k = d.y * COLS + d.x; S[k] = Math.min(S[k], DROP_FALL - d.t); E[k] = INF; Bd[k] = 1; }
  if (L.dropList && L.timeLeft <= 0) L.dropList.slice(0, 5).forEach(([x, y], i) => {
    const k = y * COLS + x; S[k] = Math.min(S[k], L.dropT + i * DROP_EVERY); E[k] = INF; Bd[k] = 1;
  });
  return { S, E, B: Bd };
}
function walkableFor(p, x, y) {
  if (!inside(x, y) || L.grid[y][x] !== 0) return false;
  const b = bombAt(x, y); return !b || p.pass.has(b);
}
function bfs(p, dz, avoid) {
  const sx = fl(p.x), sy = fl(p.y), si = sy * COLS + sx, spd = speedOf(p);
  const dist = new Int16Array(N).fill(-1), prev = new Int16Array(N).fill(-1);
  dist[si] = 0; const q = [si], order = [si];
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % COLS, y = (i / COLS) | 0;
    for (const [dx, dy] of DIRV) {
      const nx = x + dx, ny = y + dy, ni = ny * COLS + nx;
      if (!inside(nx, ny) || dist[ni] >= 0 || !walkableFor(p, nx, ny)) continue;
      const ta = (dist[i] + 1) / spd + 0.15;
      if (avoid) { if (dz.S[ni] < INF) continue; }
      else if (!(ta + 0.3 < dz.S[ni] || ta > dz.E[ni] + 0.1)) continue;
      dist[ni] = dist[i] + 1; prev[ni] = i; q.push(ni); order.push(ni);
    }
  }
  return { dist, prev, order, spd, si };
}
function pathTo(res, ti) {
  const path = []; let i = ti;
  while (res.prev[i] >= 0) { path.unshift([i % COLS, (i / COLS) | 0]); i = res.prev[i]; }
  return path;
}
function escapePath(p, dz) {
  const res = bfs(p, dz, false);
  for (const i of res.order) {
    const ta = res.dist[i] / res.spd + 0.15;
    if (!dz.B[i] && (dz.S[i] >= INF || ta > dz.E[i] + 0.1)) return pathTo(res, i);
  }
  return null; // sem rota segura
}
function botThink(p) {
  const bot = p.bot, cfg = DIFF[settings.diff];
  const dz = computeDanger(null);
  const sx = fl(p.x), sy = fl(p.y), si = sy * COLS + sx;
  // 1) em perigo: fugir
  if (dz.S[si] < INF) {
    const esc = escapePath(p, dz);
    bot.path = esc || []; return;
  }
  const opps = players.filter(o => o !== p && o.alive);
  const canBomb = p.active < p.st.bombs && !bombAt(sx, sy);
  const hits = (tiles) => opps.some(o => tiles.some(([a, b]) => a === fl(o.x) && b === fl(o.y)));
  const bushCount = (tiles) => tiles.filter(([a, b]) => L.grid[b][a] === 2 && !isBurning(a, b)).length;
  // 2) escolher objetivo
  const res = bfs(p, dz, true);
  let best = -INF, bi = si, bombGoal = false;
  for (const i of res.order) {
    const x = i % COLS, y = (i / COLS) | 0, d = res.dist[i];
    let sc = -d * 0.5, gb = false;
    if (L.powerups.some(q => q.x === x && q.y === y)) sc += 40 - d * 2;
    if (p.active < p.st.bombs && !bombAt(x, y)) {
      const tiles = blastTiles(x, y, p.st.range);
      const nb = bushCount(tiles);
      if (nb) { const v = 8 + 6 * nb - d * 2; if (v > 0) { sc += v; gb = true; } }
      if (hits(tiles)) { sc += cfg.aggr * 30 - d; gb = true; }
    }
    if (opps.length) sc -= Math.min(...opps.map(o => Math.abs(o.x - x - 0.5) + Math.abs(o.y - y - 0.5))) * 0.6 * cfg.aggr;
    sc += Math.random() * 2;
    if (sc > best) { best = sc; bi = i; bombGoal = gb; }
  }
  // 3) soltar bomba aqui?
  if (canBomb) {
    const tiles = blastTiles(sx, sy, p.st.range);
    const want = (bi === si && bombGoal) || (hits(tiles) && Math.random() < cfg.aggr);
    if (want) {
      const dz2 = computeDanger({ x: sx, y: sy, range: p.st.range, rem: FUSE });
      const esc = escapePath(p, dz2);
      if (esc && esc.length && esc.length / speedOf(p) < FUSE - 0.6) { placeBomb(p); bot.path = esc; return; }
      if (bi === si) { // não dá para fugir: andar para outro lugar
        const alt = res.order.filter(i => i !== si);
        if (alt.length) { bot.path = pathTo(res, pick(alt.slice(0, 12))); return; }
      }
    }
  }
  bot.path = pathTo(res, bi);
}
function botMove(p, dt) {
  const path = p.bot.path; p.moving = false;
  if (!path.length) return;
  const [nx, ny] = path[0];
  if (!walkableFor(p, nx, ny)) { p.bot.path = []; p.bot.idle = 0; return; }
  let rem = speedOf(p) * dt;
  const cx = fl(p.x), cy = fl(p.y);
  const go = (axis, target) => {
    const d = target - p[axis], m = Math.min(rem, Math.abs(d));
    if (m <= 1e-6) return;
    p[axis] += Math.sign(d) * m; rem -= m; p.moving = true;
    if (m > 0.004) p.dir = axis === 'x' ? (d < 0 ? 'left' : 'right') : (d < 0 ? 'up' : 'down');
  };
  if (nx !== cx && ny === cy) { go('y', cy + 0.5); go('x', nx + 0.5); }
  else if (ny !== cy && nx === cx) { go('x', cx + 0.5); go('y', ny + 0.5); }
  else { go('x', nx + 0.5); go('y', ny + 0.5); }
  if (Math.abs(p.x - nx - 0.5) < 1e-3 && Math.abs(p.y - ny - 0.5) < 1e-3) path.shift();
}
function botUpdate(p, dt) {
  const bot = p.bot, cfg = DIFF[settings.diff];
  if (bot.seen !== L.bombVer) { bot.seen = L.bombVer; bot.react = Math.min(bot.react, cfg.react * rand(0.7, 1.3)); }
  bot.react -= dt; bot.timer -= dt; bot.idle -= dt;
  if (bot.react <= 0 || bot.timer <= 0 || (!bot.path.length && bot.idle <= 0)) {
    botThink(p);
    bot.react = INF; bot.timer = cfg.interval * rand(0.8, 1.2); bot.idle = 0.15;
  }
  botMove(p, dt);
}

// ---------- Inimigos (Aventura) ----------
function updateEnemy(e, dt) {
  e.anim += dt;
  if (!e.alive) { e.dieT += dt; return; }
  const def = ENEMY[e.type];
  if ((e.tx !== e.fx || e.ty !== e.fy) && !enemyFree(e.tx, e.ty, e)) {
    [e.tx, e.ty, e.fx, e.fy] = [e.fx, e.fy, e.tx, e.ty]; e.dir = OPP[e.dir];
  }
  const ddx = e.tx + 0.5 - e.x, ddy = e.ty + 0.5 - e.y, dist = Math.hypot(ddx, ddy), step = def.speed * dt;
  if (dist > step) { e.x += ddx / dist * step; e.y += ddy / dist * step; return; }
  e.x = e.tx + 0.5; e.y = e.ty + 0.5; e.fx = e.tx; e.fy = e.ty;
  const opts = Object.keys(DIRS).filter(d => enemyFree(e.tx + DIRS[d][0], e.ty + DIRS[d][1], e));
  if (!opts.length) return;
  const target = players.filter(p => p.alive).sort((a, b) => (Math.abs(a.x - e.x) + Math.abs(a.y - e.y)) - (Math.abs(b.x - e.x) + Math.abs(b.y - e.y)))[0];
  const pdist = target ? Math.abs(target.x - e.x) + Math.abs(target.y - e.y) : 99;
  let choice;
  if (def.chase && pdist < def.chase && Math.random() < 0.75) {
    const dd = d => Math.abs(e.tx + DIRS[d][0] + 0.5 - target.x) + Math.abs(e.ty + DIRS[d][1] + 0.5 - target.y);
    choice = opts.sort((a, b) => dd(a) - dd(b))[0];
  } else if (opts.includes(e.dir) && Math.random() < 0.72) choice = e.dir;
  else { const nr = opts.filter(d => d !== OPP[e.dir]); choice = pick(nr.length ? nr : opts); }
  e.dir = choice; e.tx += DIRS[choice][0]; e.ty += DIRS[choice][1];
}

// ---------- Morte súbita: a arena fecha em espiral ----------
function spiralOrder() {
  const out = []; let x0 = 1, y0 = 1, x1 = COLS - 2, y1 = ROWS - 2;
  while (x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x++) out.push([x, y0]);
    for (let y = y0 + 1; y <= y1; y++) out.push([x1, y]);
    if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) out.push([x, y1]);
    if (x1 > x0) for (let y = y1 - 1; y > y0; y--) out.push([x0, y]);
    x0++; y0++; x1--; y1--;
  }
  return out.filter(([x, y]) => !(x % 2 === 0 && y % 2 === 0));
}
function landStone(x, y) {
  L.grid[y][x] = 1; L.stones.push([x, y]);
  L.powerups = L.powerups.filter(p => !(p.x === x && p.y === y));
  L.burning = L.burning.filter(b => !(b.x === x && b.y === y));
  L.flames.delete(key(x, y));
  const b = bombAt(x, y); if (b) removeBomb(b);
  for (const p of players) {
    if (!p.alive) continue;
    if (fl(p.x) === x && fl(p.y) === y) killPlayer(p, true);
    else if (overlapsTile(p.x, p.y, x, y)) { p.x = fl(p.x) + 0.5; p.y = fl(p.y) + 0.5; }
  }
  burst(x * T + T / 2, HUD + y * T + T, 8, 'puff', ['#ffffff', '#e6def2'], 80);
  shake = Math.max(shake, 2.5); Sound.thud();
}

// ---------- Atualização ----------
function update(dt) {
  time += dt; stateT += dt;
  pollPads();
  updateAmbient(dt);
  shake = Math.max(0, shake - dt * 20);

  switch (state) {
    case 'title': case 'setup': case 'over': case 'match':
      handleMenu(dt); if (L) updateWorld(dt); break;
    case 'pause':
      if (Input.pause && !Input.back) resume(); else handleMenu(dt);
      break;
    case 'play':
      if (Input.pause) { openPause(); break; }
      updatePlayers(dt); updateWorld(dt); break;
    case 'dead':
      updateWorld(dt);
      if (stateT > 1.8) {
        G.lives--;
        if (G.lives <= 0) {
          state = 'over'; stateT = 0;
          if (G.score > best) { best = G.score; store('bb_best', String(best)); }
          setMenu([{ label: 'Jogar de novo', act: startAdventure }, { label: 'Menu principal', act: goTitle }], { lock: 0.8 });
        } else { buildAdvLevel(); state = 'play'; }
      }
      break;
    case 'clear':
      updateWorld(dt);
      if (stateT > 2.6) { G.level++; buildAdvLevel(); state = 'play'; }
      break;
    case 'round':
      updateWorld(dt);
      if (stateT > 3.2) {
        const champ = B.wins.findIndex(w => w >= settings.wins);
        if (champ >= 0) {
          state = 'match'; stateT = 0; B.champ = champ; Sound.clear();
          setMenu([{ label: 'Revanche', act: startBattle }, { label: 'Menu principal', act: goTitle }], { lock: 0.8 });
        } else nextRound();
      }
      break;
  }
  Input.nav = []; Input.clicks = []; Input.confirm = Input.back = Input.pause = false;
  Input.kbBomb = [false, false]; Input.touchBomb = false;
}

function updatePlayers(dt) {
  const frozen = mode === 'battle' && L.intro > 0;
  for (const p of players) {
    if (!p.alive) continue;
    p.inv = Math.max(0, p.inv - dt);
    if (frozen) { p.moving = false; continue; }
    if (p.human) {
      const c = humanControl(p.id);
      if (c.bomb) {
        const own = p.st.glove && bombAt(fl(p.x), fl(p.y));
        if (own && !own.slide) throwBomb(p, own); else placeBomb(p);
      }
      movePlayer(p, c.dir, dt);
    } else botUpdate(p, dt);
    if (p.moving) p.anim += dt;
    for (const b of [...p.pass]) if (!overlapsTile(p.x, p.y, b.x, b.y)) p.pass.delete(b);
  }
}

function updateWorld(dt) {
  const live = state === 'play';
  const prevIntro = L.intro;
  L.intro = Math.max(0, L.intro - dt); L.age += dt;
  if (mode === 'battle' && prevIntro > 0 && L.intro === 0) Sound.go();
  for (const p of players) if (!p.alive) p.deathT += dt;
  // bombas
  for (const b of [...L.bombs]) updateBomb(b, dt);
  // chamas
  for (const [k, f] of L.flames) {
    f.t += dt;
    if (f.t >= FLAME_DUR) { L.flames.delete(k); continue; }
    if (f.t < FLAME_DUR * 0.8) {
      for (const e of L.enemies) if (e.alive && fl(e.x) === f.x && fl(e.y) === f.y) killEnemy(e);
      if (live) for (const p of players) if (p.alive && fl(p.x) === f.x && fl(p.y) === f.y) killPlayer(p);
    }
  }
  // arbustos queimando
  for (const b of [...L.burning]) {
    b.t += dt;
    if (b.t > 0.45) {
      L.burning.splice(L.burning.indexOf(b), 1); L.grid[b.y][b.x] = 0;
      if (mode === 'adv') G.score += 10;
      if (L.exit && L.exit.x === b.x && L.exit.y === b.y) { L.exit.revealed = true; if (L.exit.open) Sound.portal(); }
      else if (mode) rollPowerup(b.x, b.y);
    }
  }
  for (const p of L.powerups) { p.t += dt; p.protect -= dt; }
  // inimigos
  for (const e of L.enemies) updateEnemy(e, dt);
  L.enemies = L.enemies.filter(e => e.alive || e.dieT < 0.7);

  if (live) {
    for (const p of players) {
      if (!p.alive) continue;
      for (const e of L.enemies) if (e.alive && Math.hypot(e.x - p.x, e.y - p.y) < 0.62) killPlayer(p);
      const pu = L.powerups.find(q => q.x === fl(p.x) && q.y === fl(p.y));
      if (pu) collect(p, pu);
    }
    if (mode === 'adv') updateExit();
    if (mode === 'battle') updateBattle(dt);
  }
  if (L.exit) L.exit.t += dt;
  // pedras caindo
  for (const d of [...L.falling]) { d.t += dt; if (d.t >= DROP_FALL) { L.falling.splice(L.falling.indexOf(d), 1); landStone(d.x, d.y); } }
  // partículas
  for (const p of L.parts) {
    p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    const drag = p.kind === 'puff' ? 4 : 1.8; p.vx -= p.vx * drag * dt; p.vy -= p.vy * drag * dt;
    if (p.kind === 'petal' || p.kind === 'leaf') { p.vy += 60 * dt; p.vx += Math.sin(p.life * 6 + p.rot) * 30 * dt; }
    p.rot += p.vr * dt;
  }
  L.parts = L.parts.filter(p => p.life < p.max);
  for (const t of L.texts) t.t += dt;
  L.texts = L.texts.filter(t => t.t < 1.1);
  if (L.banner) { L.banner.t += dt; if (L.banner.t > 2.4) L.banner = null; }
}

function updateExit() {
  const P = P0(), ex = L.exit;
  const alive = L.enemies.filter(e => e.alive).length;
  if (!ex.open && alive === 0) { ex.open = true; if (ex.revealed) Sound.portal(); }
  if (P.alive && ex.open && ex.revealed && fl(P.x) === ex.x && fl(P.y) === ex.y && Math.hypot(P.x - ex.x - 0.5, P.y - ex.y - 0.5) < 0.35) {
    state = 'clear'; stateT = 0; G.score += 500 + G.level * 100; Sound.clear();
    burst(P.x * T, HUD + P.y * T, 30, 'petal', PAL.flowers, 180);
  }
}

function updateBattle(dt) {
  if (L.intro > 0) return;
  // relógio e morte súbita
  if (L.timeLeft > 0) {
    L.timeLeft -= dt;
    if (L.timeLeft <= 0) {
      L.timeLeft = 0; L.dropList = spiralOrder().filter(([x, y]) => L.grid[y][x] !== 1); L.dropT = 1.2;
      L.banner = { text: 'A arena está fechando!', t: 0 }; Sound.hurry();
    }
  } else if (L.dropList) {
    L.dropT -= dt;
    while (L.dropT <= 0 && L.dropList.length) {
      L.dropT += DROP_EVERY;
      const [x, y] = L.dropList.shift();
      if (L.grid[y][x] !== 1) L.falling.push({ x, y, t: 0 });
    }
  }
  // fim da rodada
  const alive = players.filter(p => p.alive);
  if (alive.length <= 1) {
    L.endT += dt;
    if (L.endT > 1.2) {
      const w = players.filter(p => p.alive);
      B.winner = w.length === 1 ? w[0].id : -1;
      if (B.winner >= 0) { B.wins[B.winner]++; const p = w[0]; burst(p.x * T, HUD + p.y * T, 30, 'petal', PAL.flowers, 180); }
      state = 'round'; stateT = 0; Sound.clear();
    }
  }
}

// ---------- Ambiente (pétalas flutuando) ----------
const ambient = Array.from({ length: 16 }, () => ({ x: rand(0, W), y: rand(0, H), vx: rand(8, 22), vy: rand(6, 16), r: rand(0, 6), s: rand(3, 5), c: pick(['#ffd1e1', '#ffffff', '#ffe9b8']) }));
function updateAmbient(dt) {
  for (const a of ambient) {
    a.x += (a.vx + Math.sin(time + a.r) * 10) * dt; a.y += a.vy * dt; a.r += dt * 1.5;
    if (a.x > W + 20 || a.y > H + 20) { a.x = rand(-40, W * 0.6); a.y = -10; }
  }
}

// ---------- Desenho: chão e pedras ----------
function drawStone(g, x, y, border) {
  const px = x * T, py = y * T;
  g.fillStyle = 'rgba(40,60,40,0.16)'; rrect(g, px + 4, py + 8, T - 2, T - 2, 12); g.fill();
  g.fillStyle = border ? PAL.borderSide : PAL.stoneSide; rrect(g, px + 2, py + 3, T - 4, T - 4, 11); g.fill();
  g.fillStyle = border ? PAL.borderTop : PAL.stoneTop; rrect(g, px + 2, py + 1, T - 4, T - 12, 11); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; rrect(g, px + 7, py + 5, T - 14, T - 22, 8); g.stroke();
  g.strokeStyle = PAL.stoneLine; g.lineWidth = 1.5; g.beginPath();
  const h = hash(x, y, 3);
  g.moveTo(px + 12 + h * 10, py + 10); g.lineTo(px + 18 + h * 8, py + 18); g.lineTo(px + 14 + h * 12, py + 26); g.stroke();
  if (hash(x, y, 7) < 0.55) {
    g.fillStyle = '#8fcf87';
    const mx = px + 8 + hash(x, y, 9) * (T - 22);
    g.beginPath(); g.arc(mx, py + 4, 5, 0, 7); g.arc(mx + 7, py + 3, 4, 0, 7); g.arc(mx + 3, py + 7, 3.5, 0, 7); g.fill();
  }
}
function bakeGround() {
  const c = groundCanvas || (groundCanvas = document.createElement('canvas'));
  c.width = COLS * T * DPR; c.height = ROWS * T * DPR;
  const g = c.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    g.fillStyle = (x + y) % 2 ? PAL.grassA : PAL.grassB; g.fillRect(x * T, y * T, T, T);
    g.strokeStyle = PAL.tuft; g.lineWidth = 1.6; g.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const tx = x * T + 6 + hash(x, y, i) * (T - 12), ty = y * T + 8 + hash(x, y, i + 5) * (T - 14);
      g.beginPath(); g.moveTo(tx - 3, ty - 4); g.lineTo(tx, ty); g.lineTo(tx + 3, ty - 5); g.stroke();
    }
    if (hash(x, y, 11) < 0.08) {
      const fx = x * T + 10 + hash(x, y, 12) * (T - 20), fy = y * T + 10 + hash(x, y, 13) * (T - 20);
      g.fillStyle = ['#ffffff', '#ffe3ef', '#fff1b3'][Math.floor(hash(x, y, 14) * 3)];
      for (let k = 0; k < 5; k++) { const a = k * 1.256; g.beginPath(); g.arc(fx + Math.cos(a) * 3, fy + Math.sin(a) * 3, 2.4, 0, 7); g.fill(); }
      g.fillStyle = '#ffcf5a'; g.beginPath(); g.arc(fx, fy, 1.8, 0, 7); g.fill();
    }
  }
  const stoneSet = new Set(L.stones.map(([x, y]) => key(x, y)));
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++)
    if (L.grid[y][x] === 1 && !stoneSet.has(key(x, y))) drawStone(g, x, y, x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1);
}

// ---------- Desenho: elementos ----------
function drawBush(x, y, burnT) {
  const cx = x * T + T / 2, cy = HUD + y * T + T / 2 + 2;
  let s = 1, a = 1;
  if (burnT !== undefined) { const p = burnT / 0.45; s = 1 + p * 0.15 - p * p * 0.9; a = 1 - p; }
  const wob = Math.sin(time * 1.6 + x * 1.3 + y) * 0.6;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy + 10); ctx.scale(s, s); ctx.translate(0, -10);
  ctx.fillStyle = 'rgba(40,70,40,0.2)'; ctx.beginPath(); ctx.ellipse(2, 15, 20, 7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = PAL.bushDark;
  ctx.beginPath(); ctx.arc(-10, 5, 13, 0, 7); ctx.arc(10, 5, 13, 0, 7); ctx.arc(0, 8, 13, 0, 7); ctx.fill();
  ctx.fillStyle = PAL.bush;
  ctx.beginPath(); ctx.arc(-9 + wob, 1, 12, 0, 7); ctx.arc(9 + wob, 1, 12, 0, 7); ctx.arc(wob, -7, 14, 0, 7); ctx.fill();
  ctx.fillStyle = PAL.bushLight;
  ctx.beginPath(); ctx.arc(-5 + wob, -11, 6, 0, 7); ctx.arc(-13 + wob, -2, 4.5, 0, 7); ctx.fill();
  const nf = 1 + Math.floor(hash(x, y, 21) * 3);
  for (let i = 0; i < nf; i++) {
    const fx = -12 + hash(x, y, 30 + i) * 24 + wob, fy = -10 + hash(x, y, 40 + i) * 16;
    ctx.fillStyle = PAL.flowers[Math.floor(hash(x, y, 50 + i) * PAL.flowers.length)];
    for (let k = 0; k < 5; k++) { const ang = k * 1.256; ctx.beginPath(); ctx.arc(fx + Math.cos(ang) * 2.6, fy + Math.sin(ang) * 2.6, 2.2, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#ffcf5a'; ctx.beginPath(); ctx.arc(fx, fy, 1.6, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawBomb(b) {
  const cx = b.px * T, gy = HUD + b.py * T + 3, cy = gy - b.h * T;
  const p = b.t / b.fuse, beat = Math.sin(b.t * (6 + p * 16));
  const s = 1 + beat * (0.04 + p * 0.05);
  ctx.save();
  ctx.fillStyle = 'rgba(40,60,40,0.22)'; ctx.beginPath(); ctx.ellipse(cx, gy + 14, 15 / (1 + b.h * 0.5), 5 / (1 + b.h * 0.5), 0, 0, 7); ctx.fill();
  ctx.translate(cx, cy); if (b.slide || b.air) ctx.rotate(time * (b.air ? 12 : 16) * (b.slide ? (b.slide.dx || b.slide.dy) : 1)); ctx.scale(s, 1 / s);
  const hot = Math.max(0, (p - 0.5) * 2);
  const grd = ctx.createRadialGradient(-5, -6, 2, 0, 0, 17);
  grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.15, mixHex('#5a6aa8', '#f07a9a', hot)); grd.addColorStop(1, mixHex('#3b4478', '#c24d75', hot));
  ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ctx.fill();
  // marca de cor do dono (modo batalha)
  if (mode === 'battle' && b.owner) { ctx.strokeStyle = PCOL[b.owner.id].tag; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 15, 0.3, Math.PI - 0.3); ctx.stroke(); }
  ctx.strokeStyle = '#4f9c5c'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -14); ctx.quadraticCurveTo(2, -20, 0, -23); ctx.stroke();
  ctx.fillStyle = '#7cc47f';
  ctx.beginPath(); ctx.ellipse(6, -21, 6, 3, -0.5, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-5, -19, 5, 2.6, 0.5, 0, 7); ctx.fill();
  const tw = 2.5 + Math.sin(time * 30) * 1.2;
  ctx.fillStyle = '#fff3a8'; ctx.beginPath(); ctx.arc(0, -24, tw, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(-6, -6, 4, 2.6, -0.6, 0, 7); ctx.fill();
  ctx.restore();
}

function drawFlame(f) {
  const p = f.t / FLAME_DUR; if (p >= 1) return;
  const cx = f.x * T + T / 2, cy = HUD + f.y * T + T / 2;
  const grow = p < 0.12 ? p / 0.12 : 1, fade = p < 0.55 ? 1 : 1 - (p - 0.55) / 0.45;
  const layers = [[0.5, 'rgba(255,150,185,0.55)'], [0.38, '#ffb3c8'], [0.26, '#ffdba0'], [0.13, '#fffcf0']];
  ctx.save(); ctx.globalAlpha = fade;
  for (const [rf, col] of layers) {
    const r = T * rf * grow * (0.75 + 0.25 * fade) * (1 + Math.sin(time * 25 + f.x + f.y) * 0.04), w = r * 0.85;
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7);
    if (f.mask & BIT.left) ctx.rect(cx - T / 2, cy - w, T / 2, w * 2);
    if (f.mask & BIT.right) ctx.rect(cx, cy - w, T / 2, w * 2);
    if (f.mask & BIT.up) ctx.rect(cx - w, cy - T / 2, w * 2, T / 2);
    if (f.mask & BIT.down) ctx.rect(cx - w, cy, w * 2, T / 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPowerup(pu) {
  const cx = pu.x * T + T / 2, cy = HUD + pu.y * T + T / 2 + Math.sin(pu.t * 3) * 3 - 2;
  const ring = { bomb: '#7b8be0', range: '#ff9e7a', speed: '#5cc7b8', life: '#ff8fb1', kick: '#f5b83d', glove: '#c58be8', shield: '#6cc3f0' }[pu.type];
  const appear = Math.min(1, pu.t * 4);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(appear, appear);
  ctx.fillStyle = 'rgba(40,60,40,0.18)'; ctx.beginPath(); ctx.ellipse(0, 19 - Math.sin(pu.t * 3) * 3, 12, 4, 0, 0, 7); ctx.fill();
  ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(0, 0, 17, 0, 7); ctx.fill();
  ctx.fillStyle = PAL.cream; ctx.beginPath(); ctx.arc(0, 0, 13.5, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(-7, -9, 5, 3, -0.6, 0, 7); ctx.fill();
  drawIcon(pu.type, 0, 1, 1);
  ctx.restore();
}

function drawIcon(type, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (type === 'bomb') {
    ctx.fillStyle = '#5a6aa8'; ctx.beginPath(); ctx.arc(0, 1, 7.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#7cc47f'; ctx.beginPath(); ctx.ellipse(3, -8, 4, 2, -0.5, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(-2.5, -1.5, 2, 0, 7); ctx.fill();
  } else if (type === 'range') {
    ctx.fillStyle = '#ff9e7a'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.quadraticCurveTo(9, 0, 6, 5); ctx.arc(0, 4, 6.3, 0.2, Math.PI - 0.2); ctx.quadraticCurveTo(-9, 0, 0, -10); ctx.fill();
    ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(0, 4, 3.4, 0, 7); ctx.fill();
  } else if (type === 'speed') {
    ctx.strokeStyle = '#3fae9f'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-7, -6); ctx.lineTo(-1, 0); ctx.lineTo(-7, 6); ctx.moveTo(0, -6); ctx.lineTo(6, 0); ctx.lineTo(0, 6); ctx.stroke();
  } else if (type === 'kick') { // botinha
    ctx.fillStyle = '#e8902c';
    rrect(ctx, -6, -9, 7, 12, 3); ctx.fill();
    rrect(ctx, -6, -1, 14, 7, 3.5); ctx.fill();
    ctx.fillStyle = '#ffe2a8'; ctx.fillRect(-6, -9, 7, 3);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(10, -6); ctx.lineTo(13, -9); ctx.moveTo(11, -1); ctx.lineTo(14, -2); ctx.stroke();
  } else if (type === 'glove') { // luva
    ctx.fillStyle = '#b07ad8';
    ctx.beginPath(); ctx.ellipse(1, -1, 6.5, 7.5, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-6, 1, 2.6, 4.2, -0.6, 0, 7); ctx.fill();
    ctx.fillStyle = '#e9d6f7'; rrect(ctx, -5, 5, 12, 4, 2); ctx.fill();
  } else if (type === 'shield') { // bolha
    ctx.fillStyle = 'rgba(108,195,240,0.35)'; ctx.beginPath(); ctx.arc(0, 0, 8.5, 0, 7); ctx.fill();
    ctx.strokeStyle = '#4aa8de'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-3, -3.5, 2.6, 1.6, -0.6, 0, 7); ctx.fill();
  } else if (type === 'life') {
    ctx.fillStyle = '#ff7fa6'; ctx.beginPath(); ctx.moveTo(0, 8);
    ctx.bezierCurveTo(-12, 0, -7, -10, 0, -4); ctx.bezierCurveTo(7, -10, 12, 0, 0, 8); ctx.fill();
  }
  ctx.restore();
}

function drawExit() {
  const e = L.exit; if (!e || !e.revealed) return;
  const cx = e.x * T + T / 2, cy = HUD + e.y * T + T / 2, t = e.t;
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(60,40,90,0.25)'; ctx.beginPath(); ctx.ellipse(0, 4, 19, 15, 0, 0, 7); ctx.fill();
  const open = e.open;
  if (open) {
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.5, 'rgba(255,214,240,0.6)'); g.addColorStop(1, 'rgba(255,214,240,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 24 + Math.sin(t * 4) * 2, 0, 7); ctx.fill();
  }
  const n = 8, rot = open ? t * 1.2 : 0;
  for (let i = 0; i < n; i++) {
    ctx.save(); ctx.rotate(rot + i * (Math.PI * 2 / n)); ctx.fillStyle = open ? (i % 2 ? '#ffb3d1' : '#ffd9e8') : (i % 2 ? '#b9adc9' : '#cbc1d8');
    ctx.beginPath(); ctx.ellipse(0, -12, 6, 10, 0, 0, 7); ctx.fill(); ctx.restore();
  }
  ctx.fillStyle = open ? '#ffe28a' : '#9d92ad'; ctx.beginPath(); ctx.arc(0, 0, 7 + (open ? Math.sin(t * 5) : 0), 0, 7); ctx.fill();
  if (open) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-2, -2, 2.5, 0, 7); ctx.fill(); }
  ctx.restore();
}

// Personagem (desenhado na origem). col = cores do jogador
function drawCritter(col, dir, moving, anim, closed) {
  const [dx, dy] = DIRS[dir];
  const fs = moving ? Math.sin(anim * 12) * 2.5 : 0;
  ctx.fillStyle = col.feet;
  ctx.beginPath(); ctx.ellipse(-7, 12 + fs, 5, 3.5, 0, 0, 7); ctx.ellipse(7, 12 - fs, 5, 3.5, 0, 0, 7); ctx.fill();
  for (const sgn of [-1, 1]) {
    ctx.save(); ctx.translate(sgn * 9, -13); ctx.rotate(sgn * 0.35 + Math.sin(time * 3) * 0.05 * sgn);
    ctx.fillStyle = col.body; ctx.beginPath(); ctx.ellipse(0, -2, 5.5, 8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = col.ear; ctx.beginPath(); ctx.ellipse(0, -2, 2.6, 5, 0, 0, 7); ctx.fill();
    ctx.restore();
  }
  const grd = ctx.createRadialGradient(-5, -7, 3, 0, 0, 19);
  grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.35, col.body); grd.addColorStop(1, col.shade);
  ctx.fillStyle = grd; ctx.beginPath(); ctx.ellipse(0, 0, 16, 14.5, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(120,90,110,0.28)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = '#4f9c5c'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -14); ctx.quadraticCurveTo(-1, -19, 1, -22); ctx.stroke();
  ctx.fillStyle = '#7cc47f';
  ctx.beginPath(); ctx.ellipse(6, -22, 6, 3, -0.4 + Math.sin(time * 3) * 0.15, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-4, -21, 4.5, 2.4, 0.5, 0, 7); ctx.fill();
  if (dir !== 'up') {
    const ex = dx * 5, ey = dy * 2 + 1;
    ctx.fillStyle = '#3d2f4a';
    for (const sx of [-5.5, 5.5]) { ctx.beginPath(); ctx.ellipse(sx + ex, -2 + ey, 2.8, closed ? 0.7 : 3.6, 0, 0, 7); ctx.fill(); }
    if (!closed) { ctx.fillStyle = '#fff'; for (const sx of [-5.5, 5.5]) { ctx.beginPath(); ctx.arc(sx + ex + 1, -3.5 + ey, 1.1, 0, 7); ctx.fill(); } }
    ctx.fillStyle = 'rgba(255,140,170,0.5)';
    ctx.beginPath(); ctx.arc(-10 + ex, 4 + ey, 3.2, 0, 7); ctx.arc(10 + ex, 4 + ey, 3.2, 0, 7); ctx.fill();
    ctx.strokeStyle = '#3d2f4a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ex, 3 + ey, 2.4, 0.2, Math.PI - 0.2); ctx.stroke();
  } else {
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 10, 4, 0, 7); ctx.fill();
  }
}

function drawPlayer(p) {
  let px = p.x * T, py = HUD + p.y * T;
  if (!p.alive && p.deathT > 1.3) return;
  ctx.save();
  if (!p.alive) {
    const k = Math.min(1, p.deathT / 1.3);
    ctx.globalAlpha = 1 - k; py -= k * 34;
    ctx.translate(px, py); ctx.rotate(k * 6); ctx.scale(1 - k * 0.6, 1 - k * 0.6); ctx.translate(-px, -py);
  } else if (p.inv > 0 && Math.floor(p.inv * 10) % 2 === 0) ctx.globalAlpha = 0.45;
  const bob = p.moving ? Math.abs(Math.sin(p.anim * 12)) * 4 : Math.sin(time * 2.5 + p.id);
  const sq = p.moving ? 1 + Math.sin(p.anim * 24) * 0.04 : 1 + Math.sin(time * 2.5 + p.id) * 0.02;
  if (p.alive) { ctx.fillStyle = 'rgba(40,60,40,0.22)'; ctx.beginPath(); ctx.ellipse(px, py + 17, 14 - bob * 0.6, 5, 0, 0, 7); ctx.fill(); }
  ctx.save();
  ctx.translate(px, py + 3 - bob); ctx.scale(sq, 2 - sq);
  p.blink -= 1 / 60; if (p.blink < -0.12) p.blink = rand(2, 4.5);
  drawCritter(PCOL[p.id], p.dir, p.moving, p.anim, p.blink < 0 || !p.alive);
  ctx.restore();
  if (p.alive && p.st.shield) {
    const r = 23 + Math.sin(time * 4) * 1.2;
    ctx.fillStyle = 'rgba(150,215,255,0.18)'; ctx.strokeStyle = 'rgba(110,190,240,0.75)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(px - 9, py - 12, 5, 2.6, -0.7, 0, 7); ctx.fill();
  }
  // etiqueta com nome no início da rodada (modo batalha)
  if (mode === 'battle' && p.alive && L.age < 4) {
    const a = Math.min(1, (4 - L.age) * 2);
    ctx.globalAlpha = a; const name = playerName(p);
    ctx.font = `700 13px ${FONT}`; const w = ctx.measureText(name).width + 14;
    ctx.fillStyle = PCOL[p.id].tag; rrect(ctx, px - w / 2, py - 46, w, 20, 10); ctx.fill();
    ctx.beginPath(); ctx.moveTo(px - 5, py - 27); ctx.lineTo(px + 5, py - 27); ctx.lineTo(px, py - 21); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(name, px, py - 36);
  }
  ctx.restore();
}

function drawEnemy(e) {
  const px = e.x * T, py = HUD + e.y * T, t = e.anim;
  ctx.save();
  let sx = 1, sy = 1;
  if (!e.alive) { const k = e.dieT / 0.7; sx = 1 + k * 0.6; sy = 1 - k; ctx.globalAlpha = 1 - k; }
  const [dx, dy] = DIRS[e.dir];
  if (e.type === 'slime') {
    ctx.fillStyle = 'rgba(40,60,40,0.2)'; ctx.beginPath(); ctx.ellipse(px, py + 15, 15, 5, 0, 0, 7); ctx.fill();
    const w = Math.sin(t * 6) * 0.08;
    ctx.translate(px, py + 15); ctx.scale(sx * (1 + w), sy * (1 - w));
    const g = ctx.createLinearGradient(0, -30, 0, 0); g.addColorStop(0, '#d2bdff'); g.addColorStop(1, '#a78be8');
    ctx.fillStyle = g; ctx.beginPath();
    ctx.moveTo(-16, 0); ctx.quadraticCurveTo(-17, -26, 0, -27); ctx.quadraticCurveTo(17, -26, 16, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(-7, -19, 4, 2.5, -0.6, 0, 7); ctx.fill();
    drawEyes(dx * 3, -13 + dy * 2, 5, e.alive);
  } else if (e.type === 'beetle') {
    ctx.fillStyle = 'rgba(40,60,40,0.2)'; ctx.beginPath(); ctx.ellipse(px, py + 15, 14, 5, 0, 0, 7); ctx.fill();
    ctx.translate(px, py + 2 - Math.abs(Math.sin(t * 14)) * 2); ctx.scale(sx, sy);
    ctx.strokeStyle = '#7a4a3a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const lx = s * 11, ly = -2 + i * 6, k = Math.sin(t * 16 + i * 2 + s) * 2.5;
      ctx.beginPath(); ctx.moveTo(lx * 0.8, ly); ctx.lineTo(lx * 1.35, ly + 3 + k); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(-4, -13); ctx.quadraticCurveTo(-9, -22, -12, -20); ctx.moveTo(4, -13); ctx.quadraticCurveTo(9, -22, 12, -20); ctx.stroke();
    ctx.fillStyle = '#ffd56b'; ctx.beginPath(); ctx.arc(-12, -20, 2.5, 0, 7); ctx.arc(12, -20, 2.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff9a7a'; ctx.beginPath(); ctx.ellipse(0, 2, 14, 13, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#e07a62'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 14); ctx.stroke();
    ctx.fillStyle = '#ffd7c4';
    for (const [ax, ay] of [[-6, 6], [6, 3], [-5, -2], [7, 10]]) { ctx.beginPath(); ctx.arc(ax, ay, 2, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#f2876a'; ctx.beginPath(); ctx.ellipse(0, -9, 9, 6, 0, 0, 7); ctx.fill();
    drawEyes(dx * 2, -10 + dy * 1.5, 3.8, e.alive);
  } else {
    const f = Math.sin(t * 3) * 4;
    ctx.fillStyle = 'rgba(40,60,40,0.14)'; ctx.beginPath(); ctx.ellipse(px, py + 16, 11, 4, 0, 0, 7); ctx.fill();
    ctx.globalAlpha *= 0.85;
    ctx.translate(px, py - 2 + f); ctx.scale(sx, sy);
    const g = ctx.createRadialGradient(-4, -8, 2, 0, 0, 20); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#9fd4ff');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -4, 13, Math.PI, 0);
    for (let i = 0; i <= 4; i++) { const xx = 13 - i * 6.5; ctx.lineTo(xx, 10 + (i % 2 ? -3 : 3) + Math.sin(t * 8 + i) * 2); }
    ctx.closePath(); ctx.fill();
    drawEyes(dx * 2.5, -5 + dy * 2, 4.2, e.alive, '#3a5b8a');
  }
  ctx.restore();
}
function drawEyes(ox, oy, gap, alive, col = '#3d2f4a') {
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(s * gap + ox * 0.5, oy, 3.8, 4.4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = col;
    if (alive) { ctx.beginPath(); ctx.arc(s * gap + ox, oy + 0.5, 2.1, 0, 7); ctx.fill(); }
    else { ctx.lineWidth = 1.5; ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(s * gap - 2, oy - 2); ctx.lineTo(s * gap + 2, oy + 2); ctx.moveTo(s * gap + 2, oy - 2); ctx.lineTo(s * gap - 2, oy + 2); ctx.stroke(); }
  }
}

function drawParticles() {
  for (const p of L.parts) {
    const k = p.life / p.max;
    ctx.save(); ctx.globalAlpha = 1 - k; ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color;
    if (p.kind === 'petal') { ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, 7); ctx.fill(); }
    else if (p.kind === 'leaf') { ctx.beginPath(); ctx.ellipse(0, 0, p.size * 1.2, p.size * 0.5, 0, 0, 7); ctx.fill(); }
    else if (p.kind === 'puff') { ctx.beginPath(); ctx.arc(0, 0, p.size * (1 + k * 1.5), 0, 7); ctx.fill(); }
    else { ctx.fillRect(-p.size / 2, -1, p.size, 2); ctx.fillRect(-1, -p.size / 2, 2, p.size); }
    ctx.restore();
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 16px ${FONT}`;
  for (const t of L.texts) {
    ctx.globalAlpha = 1 - t.t / 1.1;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(75,59,92,0.7)'; ctx.strokeText(t.text, t.x, t.y - t.t * 30);
    ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y - t.t * 30);
  }
  ctx.globalAlpha = 1;
}

function drawBoard() {
  ctx.drawImage(groundCanvas, 0, HUD, COLS * T, ROWS * T);
  ctx.save(); ctx.translate(0, HUD);
  for (const [x, y] of L.stones) drawStone(ctx, x, y, false);
  ctx.restore();
  // sombra de aviso onde a pedra vai cair
  for (const d of L.falling) {
    const k = d.t / DROP_FALL;
    ctx.fillStyle = `rgba(60,40,90,${0.15 + k * 0.25})`;
    ctx.beginPath(); ctx.ellipse(d.x * T + T / 2, HUD + d.y * T + T / 2 + 6, 8 + k * 14, 4 + k * 7, 0, 0, 7); ctx.fill();
  }
  drawExit();
  for (const pu of L.powerups) drawPowerup(pu);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (L.grid[y][x] !== 2) continue;
    const b = L.burning.find(b => b.x === x && b.y === y);
    drawBush(x, y, b ? b.t : undefined);
  }
  for (const b of L.bombs) drawBomb(b);
  for (const f of L.flames.values()) drawFlame(f);
  const ents = L.enemies.map(e => ({ y: e.y, d: () => drawEnemy(e) }));
  for (const p of players) ents.push({ y: p.y, d: () => drawPlayer(p) });
  ents.sort((a, b) => a.y - b.y).forEach(e => e.d());
  for (const d of L.falling) {
    const k = d.t / DROP_FALL;
    ctx.save(); ctx.beginPath(); ctx.rect(0, HUD, W, ROWS * T); ctx.clip(); ctx.globalAlpha = 0.4 + 0.6 * k; ctx.translate(0, HUD - (1 - k) * (1 - k) * 260);
    drawStone(ctx, d.x, d.y, false); ctx.restore();
  }
  drawParticles();
}

// ---------- HUD ----------
function pill(x, y, w, h, col) { ctx.fillStyle = col; rrect(ctx, x, y, w, h, h / 2); ctx.fill(); }
function drawHUD() {
  ctx.fillStyle = '#f6efe4'; ctx.fillRect(0, 0, W, HUD);
  ctx.fillStyle = 'rgba(75,59,92,0.08)'; ctx.fillRect(0, HUD - 4, W, 4);
  ctx.textBaseline = 'middle';
  if (mode === 'adv') drawAdvHUD();
  else if (mode === 'battle') drawBattleHUD();
  else { ctx.font = `700 26px ${FONT}`; ctx.fillStyle = PAL.ink; ctx.textAlign = 'center'; ctx.fillText('Bloomblast', W / 2, HUD / 2); }
}
function drawAdvHUD() {
  const cy = HUD / 2 - 1; ctx.textAlign = 'left';
  pill(12, cy - 19, 102, 38, '#e7dcf5');
  ctx.font = `600 13px ${FONT}`; ctx.fillStyle = '#8a77a3'; ctx.fillText('NÍVEL', 26, cy - 7);
  ctx.font = `700 22px ${FONT}`; ctx.fillStyle = PAL.ink; ctx.fillText(G.level, 26, cy + 10);
  drawIcon('life', 86, cy, 1.1);
  ctx.font = `700 15px ${FONT}`; ctx.fillStyle = PAL.ink; ctx.fillText('×' + G.lives, 84, cy + 15);
  [['bomb', G.bombs, '#dde3ff'], ['range', G.range, '#ffe4d8'], ['speed', G.speedUps, '#d6f3ee']].forEach(([ic, v, col], i) => {
    const x = 126 + i * 78; pill(x, cy - 19, 68, 38, col);
    drawIcon(ic, x + 21, cy + 1, 1.1);
    ctx.font = `700 20px ${FONT}`; ctx.fillStyle = PAL.ink; ctx.fillText(v, x + 38, cy + 1);
  });
  const alive = L.enemies.filter(e => e.alive).length;
  pill(368, cy - 19, 120, 38, alive ? '#efe6ff' : '#ffe3ef');
  ctx.font = `600 13px ${FONT}`; ctx.fillStyle = '#8a77a3'; ctx.fillText(alive ? 'INIMIGOS' : 'PORTAL', 384, cy - 7);
  ctx.font = `700 18px ${FONT}`; ctx.fillStyle = PAL.ink;
  ctx.fillText(alive ? String(alive) : (L.exit.revealed ? 'aberto!' : 'encontre'), 384, cy + 10);
  pill(W - 182, cy - 19, 170, 38, '#fff8e6');
  ctx.textAlign = 'right';
  ctx.font = `600 13px ${FONT}`; ctx.fillStyle = '#b39150'; ctx.fillText('PONTOS', W - 26, cy - 7);
  ctx.font = `700 22px ${FONT}`; ctx.fillStyle = PAL.ink; ctx.fillText(G.score.toLocaleString('pt-BR'), W - 26, cy + 10);
}
function drawMiniFlower(x, y, r, col) {
  ctx.fillStyle = col;
  for (let k = 0; k < 5; k++) { const a = k * 1.256 - 1.57; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, 7); ctx.fill();
}
function drawWins(x, y, wins, col, size = 6) {
  for (let k = 0; k < settings.wins; k++) drawMiniFlower(x + k * (size * 2.4), y, size, k < wins ? col : '#d9d0e3');
}
function drawMiniCritter(x, y, p, s = 0.62) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); drawCritter(PCOL[p.id], 'down', false, 0, !p.alive); ctx.restore();
}
function drawBattleHUD() {
  const cy = HUD / 2 - 1, xs = [12, 158, 422, 568];
  players.forEach((p, i) => {
    const x = xs[i];
    ctx.save(); if (!p.alive) ctx.globalAlpha = 0.45;
    pill(x, cy - 21, 140, 42, PCOL[i].tint);
    drawMiniCritter(x + 24, cy + 3, p);
    ctx.textAlign = 'left'; ctx.font = `700 15px ${FONT}`; ctx.fillStyle = PAL.ink;
    ctx.fillText(playerName(p), x + 46, cy - 8);
    drawWins(x + 52, cy + 10, B.wins[i], PCOL[i].tag);
    let ix = x + 122;
    for (const it of ['shield', 'glove', 'kick']) if (p.st[it]) { drawIcon(it, ix, cy - 8, 0.85); ix -= 18; }
    ctx.restore();
  });
  pill(W / 2 - 48, cy - 21, 96, 42, L.timeLeft > 0 && L.timeLeft < 20 ? '#ffe3ef' : '#fff8e6');
  ctx.textAlign = 'center';
  if (L.timeLeft > 0) {
    const s = Math.ceil(L.timeLeft), txt = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    ctx.font = `700 24px ${FONT}`; ctx.fillStyle = PAL.ink; ctx.fillText(txt, W / 2, cy + 1);
  } else {
    ctx.font = `700 14px ${FONT}`; ctx.fillStyle = '#e0668f'; ctx.globalAlpha = 0.6 + Math.sin(time * 6) * 0.4;
    ctx.fillText('FECHANDO', W / 2, cy + 1); ctx.globalAlpha = 1;
  }
}

// ---------- Telas ----------
function card(w, h) {
  ctx.fillStyle = 'rgba(46,32,68,0.42)'; ctx.fillRect(0, 0, W, H);
  const x = (W - w) / 2, y = (H - h) / 2 + 20;
  ctx.fillStyle = 'rgba(40,25,60,0.25)'; rrect(ctx, x, y + 8, w, h, 28); ctx.fill();
  ctx.fillStyle = PAL.cream; rrect(ctx, x, y, w, h, 28); ctx.fill();
  return { x, y };
}
function centerText(txt, y, size, col = PAL.ink, weight = 700) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = col; ctx.fillText(txt, W / 2, y);
}
function drawLogo(y) {
  const word = 'Bloomblast', cols = ['#ff8fb1', '#ffb36b', '#f5c242', '#7cc47f', '#5cc7b8', '#7b8be0', '#b48cf0', '#ff8fb1', '#ffb36b', '#7cc47f'];
  ctx.font = `700 60px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  let total = 0; for (const ch of word) total += ctx.measureText(ch).width;
  let x = W / 2 - total / 2;
  [...word].forEach((ch, i) => {
    const yy = y + Math.sin(time * 2.2 + i * 0.6) * 4;
    ctx.lineWidth = 10; ctx.strokeStyle = '#4b3b5c'; ctx.lineJoin = 'round'; ctx.strokeText(ch, x, yy + 3);
    ctx.fillStyle = cols[i]; ctx.fillText(ch, x, yy);
    x += ctx.measureText(ch).width;
  });
}
const pulse = () => 0.55 + Math.sin(time * 4) * 0.45;
function drawMenu(y, w = 380, h = 46, gap = 10) {
  menu.rects = [];
  menu.items.forEach((it, i) => {
    const x = (W - w) / 2, yy = y + i * (h + gap), sel = i === menu.sel;
    menu.rects.push({ x, y: yy, w, h });
    ctx.fillStyle = sel ? (it.accent ? '#ff8fb1' : '#b48cf0') : (it.accent ? '#ffe3ef' : '#efe8f7');
    rrect(ctx, x, yy, w, h, h / 2); ctx.fill();
    if (sel) { ctx.strokeStyle = 'rgba(75,59,92,0.25)'; ctx.lineWidth = 2; ctx.stroke(); }
    const tc = sel ? '#ffffff' : PAL.ink;
    ctx.textBaseline = 'middle'; ctx.font = `${it.change ? 600 : 700} ${it.change ? 17 : 19}px ${FONT}`; ctx.fillStyle = tc;
    if (it.change) {
      ctx.textAlign = 'left'; ctx.fillText(it.label, x + 22, yy + h / 2 + 1);
      const la = x + w - 146, ra = x + w - 26, my = yy + h / 2;
      menu.rects[i].la = la; menu.rects[i].ra = ra;
      for (const [ax, ch] of [[la, '‹'], [ra, '›']]) {
        ctx.fillStyle = sel ? 'rgba(255,255,255,0.3)' : 'rgba(75,59,92,0.1)';
        ctx.beginPath(); ctx.arc(ax, my, 15, 0, 7); ctx.fill();
        ctx.fillStyle = tc; ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillText(ch, ax, my - 1);
      }
      ctx.textAlign = 'center'; ctx.font = `700 17px ${FONT}`; ctx.fillStyle = tc;
      ctx.fillText(it.get(), (la + ra) / 2, my + 1);
    } else { ctx.textAlign = 'center'; ctx.fillText(it.label, W / 2, yy + h / 2 + 1); }
  });
}
function drawScoreRows(y) {
  players.forEach((p, i) => {
    const yy = y + i * 40, x = W / 2 - 130;
    const win = B.winner === p.id || (state === 'match' && B.champ === p.id);
    pill(x, yy - 17, 260, 34, win ? PCOL[i].tint : '#f3eef8');
    drawMiniCritter(x + 22, yy + 2, { id: i, alive: true }, 0.55);
    ctx.textAlign = 'left'; ctx.font = `700 16px ${FONT}`; ctx.fillStyle = PAL.ink; ctx.fillText(playerName(p), x + 44, yy + 1);
    drawWins(x + 130, yy, B.wins[i], PCOL[i].tag, 7);
  });
}

function drawOverlay() {
  const ctrlHint = isTouch ? 'Joystick: mover  ·  BOMBA: soltar semente' : 'Setas / WASD: mover   ·   Espaço: bomba   ·   P: pausar   ·   M: música';
  if (state === 'title') {
    const { y } = card(540, 400);
    drawLogo(y + 66);
    centerText('Um jardim explosivo e relaxante', y + 118, 18, '#8a77a3', 600);
    drawMenu(y + 158, 380, 52, 14);
    centerText(ctrlHint, y + 306, 14, '#7a6a8c', 500);
    centerText(isTouch ? 'Toque numa opção para começar' : 'Escolha com as setas e confirme com ENTER', y + 332, 14, '#a394b5', 500);
    if (best) centerText('Recorde da Aventura: ' + best.toLocaleString('pt-BR'), y + 366, 15, '#b39150', 700);
  } else if (state === 'setup') {
    const { y } = card(540, 590);
    centerText('Modo Batalha', y + 46, 36, '#e0668f');
    centerText('O último de pé vence a rodada', y + 80, 16, '#8a77a3', 600);
    drawMenu(y + 104, 440, 42, 9);
    centerText(VARIANT[settings.variant].desc, y + 488, 15, settings.variant === 'party' ? '#e0668f' : '#7a6a8c', 600);
    const lines = isTouch ? ['No celular só o J1 joga pela tela;', 'os outros jogadores precisam de controle.'] :
      ['J1: WASD + Espaço   ·   J2: Setas + Enter', 'J3 e J4: controles (Xbox / PlayStation)'];
    lines.forEach((l, i) => centerText(l, y + 528 + i * 24, 14, '#7a6a8c', 500));
  } else if (state === 'pause') {
    const { y } = card(400, 230);
    centerText('Pausado', y + 52, 38);
    drawMenu(y + 96, 300, 46, 12);
  } else if (state === 'clear') {
    const { y } = card(420, 200);
    centerText('Jardim florido!', y + 64, 40, '#e0668f');
    centerText(`Nível ${G.level} concluído`, y + 112, 20, PAL.ink, 600);
    centerText(`Bônus +${500 + G.level * 100}`, y + 150, 18, '#b39150', 700);
  } else if (state === 'over') {
    const { y } = card(420, 300);
    centerText('Fim de jogo', y + 54, 42);
    centerText('Pontos: ' + G.score.toLocaleString('pt-BR'), y + 104, 22, PAL.ink, 600);
    centerText('Recorde: ' + best.toLocaleString('pt-BR'), y + 136, 18, '#b39150', 700);
    drawMenu(y + 176, 300, 46, 12);
  } else if (state === 'round') {
    const { y } = card(420, 130 + B.n * 40);
    const w = players.find(p => p.id === B.winner);
    centerText(w ? playerName(w) + ' venceu a rodada!' : 'Empate!', y + 48, 30, w ? PCOL[w.id].tag : PAL.ink);
    centerText('Rodada ' + B.round, y + 82, 15, '#8a77a3', 600);
    drawScoreRows(y + 120);
  } else if (state === 'match') {
    const { y } = card(440, 272 + B.n * 40);
    const c = players[B.champ];
    centerText('🏆', y + 46, 40);
    centerText(playerName(c) + ' é o campeão!', y + 96, 32, PCOL[c.id].tag);
    drawScoreRows(y + 140);
    drawMenu(y + 150 + B.n * 40, 300, 44, 10);
  }
  if (state === 'play' && L.intro > 0) {
    const a = Math.min(1, L.intro * 2);
    const txt = mode === 'battle' ? (L.intro > 0.7 ? 'Rodada ' + B.round : 'Já!') : 'Nível ' + G.level;
    ctx.save(); ctx.globalAlpha = a;
    const w = 240, h = 64, x = (W - w) / 2, y = HUD + 40 - (1 - a) * 20;
    ctx.fillStyle = 'rgba(75,59,92,0.85)'; rrect(ctx, x, y, w, h, 32); ctx.fill();
    centerText(txt, y + h / 2, 30, '#fff');
    ctx.restore();
  }
  if (L && L.banner && (state === 'play')) {
    const a = Math.min(1, (2.4 - L.banner.t) * 2);
    ctx.save(); ctx.globalAlpha = a;
    const w = 380, h = 56, x = (W - w) / 2, y = HUD + 40;
    ctx.fillStyle = 'rgba(224,102,143,0.92)'; rrect(ctx, x, y, w, h, 28); ctx.fill();
    centerText(L.banner.text, y + h / 2, 24, '#fff');
    ctx.restore();
  }
}

function drawAmbient() {
  for (const a of ambient) {
    ctx.save(); ctx.globalAlpha = 0.55; ctx.translate(a.x, a.y); ctx.rotate(a.r);
    ctx.fillStyle = a.c; ctx.beginPath(); ctx.ellipse(0, 0, a.s, a.s * 0.55, 0, 0, 7); ctx.fill(); ctx.restore();
  }
}

function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (shake > 0) ctx.translate(rand(-shake, shake) * 0.5, rand(-shake, shake) * 0.5);
  drawBoard();
  ctx.restore();
  drawHUD();
  drawAmbient();
  drawOverlay();
}

// ---------- Loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt); draw();
  requestAnimationFrame(frame);
}
goTitle();
resize();
(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(frame));
window.__menuRects = () => menu && menu.rects;
// exposto para testes/depuração
window.__bb = {
  get state() { return state; }, get mode() { return mode; }, get G() { return G; }, get B() { return B; }, get L() { return L; },
  get players() { return players; }, settings, startBattle, update, step: (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) update(dt); }
};
