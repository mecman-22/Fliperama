/* =========================================================================
   STARLIT SWARM  —  um clássico de naves reimaginado
   Tudo (gráficos e sons) é gerado por código: nenhum asset de terceiros.
   ========================================================================= */
'use strict';
(() => {

// ---------------------------------------------------------------- base ---
const W = 600, H = 800, TAU = Math.PI * 2;
const FONT = '"Segoe UI", "Trebuchet MS", system-ui, -apple-system, sans-serif';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let scale = 1, dpr = 1;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  scale = Math.min(innerWidth / W, innerHeight / H);
  canvas.style.width = W * scale + 'px';
  canvas.style.height = H * scale + 'px';
  canvas.width = Math.round(W * scale * dpr);
  canvas.height = Math.round(H * scale * dpr);
}
addEventListener('resize', resize);
resize();

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const easeOut = x => 1 - Math.pow(1 - x, 3);
const fmt = n => n.toLocaleString('pt-BR');

const store = {
  get(k, d) { try { const v = localStorage.getItem('starlit.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('starlit.' + k, JSON.stringify(v)); } catch (e) { /* sem storage */ } },
};

// --------------------------------------------------------------- áudio ---
const Sound = {
  ctx: null, muted: store.get('muted', false), lastDust: 0, nextChord: 0, chordIdx: 0,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.9; this.master.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.55; this.sfx.connect(this.master);
    this.music = c.createGain(); this.music.gain.setValueAtTime(0, c.currentTime);
    this.music.gain.linearRampToValueAtTime(0.3, c.currentTime + 5); this.music.connect(this.master);
    // eco suave para a música
    this.delay = c.createDelay(1.5); this.delay.delayTime.value = 0.42;
    const fb = c.createGain(); fb.gain.value = 0.4;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    this.delay.connect(lp); lp.connect(fb); fb.connect(this.delay); lp.connect(this.music);
    const len = c.sampleRate, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = b;
    this.nextChord = c.currentTime + 0.3;
    setInterval(() => this.schedule(), 250);
  },
  env(g, t, vol, att, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  },
  tone(freq, dur, { type = 'sine', vol = 0.2, slide = null, delay = 0, dest = null } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    this.env(g, t, vol, 0.008, dur);
    o.connect(g); g.connect(dest || this.sfx); o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, vol, f0, f1) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); this.env(g, t, vol, 0.005, dur);
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.05);
  },
  shoot() { this.tone(980, 0.11, { type: 'triangle', vol: 0.08, slide: 520 }); },
  boom(big) { this.noise(big ? 0.8 : 0.4, big ? 0.45 : 0.26, big ? 2400 : 3200, 120); this.tone(big ? 160 : 240, big ? 0.5 : 0.22, { vol: 0.16, slide: 50 }); },
  dive() { this.tone(1400, 1.1, { vol: 0.03, slide: 380 }); },
  power() { [72, 76, 79, 84].forEach((m, i) => this.tone(mtof(m), 0.25, { type: 'triangle', vol: 0.11, delay: i * 0.07 })); },
  shield() { this.tone(300, 0.35, { vol: 0.2, slide: 900 }); },
  hurt() { this.noise(1.2, 0.5, 1800, 60); this.tone(300, 1.0, { type: 'sawtooth', vol: 0.07, slide: 40 }); },
  dust() {
    const n = performance.now(); if (n - this.lastDust < 45) return; this.lastDust = n;
    this.tone(mtof(pick([84, 86, 88, 91, 93])), 0.08, { vol: 0.03 });
  },
  clink() { this.tone(1900, 0.09, { type: 'square', vol: 0.035, slide: 1200 }); },
  bossShot() { this.tone(520, 0.22, { type: 'square', vol: 0.03, slide: 180 }); },
  wave() { [60, 64, 67, 72, 76].forEach((m, i) => this.tone(mtof(m), 0.5, { vol: 0.06, delay: i * 0.09 })); },
  schedule() {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    if (this.nextChord < c.currentTime) this.nextChord = c.currentTime + 0.1;
    while (this.nextChord < c.currentTime + 1.0) { this.playChord(this.nextChord); this.nextChord += 6.4; }
  },
  playChord(t) {
    // Fmaj7 → Cmaj7 → Dm(add9) → Am7 : progressão calma e "flutuante"
    const chords = [[53, 57, 60, 64], [48, 55, 59, 64], [50, 53, 57, 64], [45, 52, 55, 60]];
    const ch = chords[this.chordIdx++ % chords.length], dur = 7.2, c = this.ctx;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(450, t); lp.frequency.linearRampToValueAtTime(1100, t + 3); lp.frequency.linearRampToValueAtTime(450, t + dur);
    lp.connect(this.music);
    for (const m of ch) for (const det of [-7, 7]) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.045, t + 2.2); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(lp); o.start(t); o.stop(t + dur + 0.1);
    }
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = mtof(ch[0] - 12);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12, t + 1.5); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.music); o.start(t); o.stop(t + dur + 0.1);
    for (let i = 0; i < 16; i++) if (Math.random() < 0.3) this.bell(mtof(pick(ch) + 24), t + i * 0.4);
  },
  bell(f, t) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(g); g.connect(this.music); g.connect(this.delay); o.start(t); o.stop(t + 1.7);
  },
  toggle() {
    this.muted = !this.muted; store.set('muted', this.muted);
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
  },
};

// ------------------------------------------------------------- sprites ---
const SPR = 2; // renderiza sprites em 2x para ficarem nítidos
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function sprite(size, glow, draw) {
  const c = makeCanvas(size * SPR, size * SPR), g = c.getContext('2d');
  g.scale(SPR, SPR); g.translate(size / 2, size / 2);
  g.shadowColor = glow; g.shadowBlur = 10;
  draw(g);
  c.size = size;
  return c;
}
function radial(g, x, y, r, stops) { const gr = g.createRadialGradient(x, y, 0, x, y, r); stops.forEach((s, i) => gr.addColorStop(i / (stops.length - 1), s)); return gr; }
function eye(g, x, y, rx, ry, col = '#0a1030') {
  const sb = g.shadowBlur; g.shadowBlur = 0;
  g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(x - rx * 0.35, y - ry * 0.35, Math.max(0.7, rx * 0.35), 0, TAU); g.fill();
  g.shadowBlur = sb;
}

const ART = {
  drone(g, f) {
    g.fillStyle = 'rgba(94,242,255,0.55)';
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * 5, -3);
      g.quadraticCurveTo(s * 18, f ? -12 : -4, s * 17, f ? 2 : 8);
      g.quadraticCurveTo(s * 11, f ? 2 : 5, s * 5, 4); g.closePath(); g.fill();
    }
    g.strokeStyle = '#5ef2ff'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-3, -8); g.lineTo(-6, -14); g.moveTo(3, -8); g.lineTo(6, -14); g.stroke();
    g.fillStyle = '#eaffff'; g.beginPath(); g.arc(-6, -14, 1.6, 0, TAU); g.arc(6, -14, 1.6, 0, TAU); g.fill();
    g.fillStyle = radial(g, -2, -3, 12, ['#eaffff', '#5ef2ff', '#1477a8']);
    g.beginPath(); g.ellipse(0, 0, 8, 10, 0, 0, TAU); g.fill();
    eye(g, -3.2, 2, 2.2, 2.8); eye(g, 3.2, 2, 2.2, 2.8);
  },
  stinger(g, f) {
    g.fillStyle = 'rgba(180,140,255,0.6)';
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * 3, -2);
      g.lineTo(s * (f ? 19 : 17), f ? -14 : -8); g.lineTo(s * (f ? 14 : 15), f ? -2 : 4); g.lineTo(s * 4, 5);
      g.closePath(); g.fill();
    }
    const gr = g.createLinearGradient(0, -11, 0, 13);
    gr.addColorStop(0, '#f3e9ff'); gr.addColorStop(0.5, '#b48cff'); gr.addColorStop(1, '#5a2fc0');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, -11); g.quadraticCurveTo(8, -6, 6, 2); g.lineTo(0, 14); g.lineTo(-6, 2); g.quadraticCurveTo(-8, -6, 0, -11); g.fill();
    eye(g, 0, -1, 3.6, 2.6, '#1a0838');
    g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 9, 1.4, 0, TAU); g.fill();
  },
  warden(g, f) {
    g.fillStyle = 'rgba(255,122,217,0.45)';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 13, f ? -7 : -3, 7, 4, s * -0.5, 0, TAU); g.fill(); }
    g.strokeStyle = '#ff9be4'; g.lineWidth = 3; g.lineCap = 'round';
    for (const s of [-1, 1]) {
      const tx = s * (f ? 9 : 12);
      g.beginPath(); g.moveTo(s * 7, 3); g.quadraticCurveTo(s * 15, 8, tx, 15); g.stroke();
      g.lineWidth = 2; g.beginPath(); g.moveTo(tx, 15); g.lineTo(tx - s * 4, 11); g.stroke(); g.lineWidth = 3;
    }
    g.fillStyle = radial(g, -3, -4, 14, ['#ffe6f7', '#ff7ad9', '#a3206f']);
    g.beginPath(); g.ellipse(0, -1, 11, 8, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.2;
    g.beginPath(); g.arc(0, -1, 6, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    eye(g, -4, 1, 2, 2.4, '#3a0626'); eye(g, 4, 1, 2, 2.4, '#3a0626');
  },
  monarch(g, f) {
    g.fillStyle = 'rgba(255,170,70,0.55)';
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * 6, -4);
      g.bezierCurveTo(s * 22, f ? -22 : -14, s * 29, f ? -2 : 4, s * 21, f ? 8 : 12);
      g.quadraticCurveTo(s * 12, 6, s * 6, 6); g.closePath(); g.fill();
    }
    g.strokeStyle = 'rgba(255,240,200,0.6)'; g.lineWidth = 1;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 7, 0); g.quadraticCurveTo(s * 16, f ? -8 : -4, s * 21, f ? 2 : 7); g.stroke(); }
    g.fillStyle = '#ffe9a8';
    g.beginPath(); g.moveTo(-8, -8); g.lineTo(-7, -18); g.lineTo(-3, -11); g.lineTo(0, -20); g.lineTo(3, -11); g.lineTo(7, -18); g.lineTo(8, -8); g.closePath(); g.fill();
    g.fillStyle = radial(g, -3, -4, 15, ['#fff7dc', '#ffd36e', '#c27a12']);
    g.beginPath(); g.ellipse(0, 0, 10, 12, 0, 0, TAU); g.fill();
    g.fillStyle = '#ff4f6d'; g.beginPath(); g.moveTo(0, 2); g.lineTo(3, 6); g.lineTo(0, 10); g.lineTo(-3, 6); g.closePath(); g.fill();
    eye(g, -4, -2, 1.8, 2.2, '#3a2006'); eye(g, 4, -2, 1.8, 2.2, '#3a2006');
  },
  shell(g, f) {
    g.fillStyle = 'rgba(168,255,122,0.5)';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 12, f ? 1 : 5, 6, 3, s * 0.6, 0, TAU); g.fill(); }
    g.fillStyle = '#2b5a20'; g.beginPath(); g.ellipse(0, 7, 7, 4.5, 0, 0, TAU); g.fill();
    g.fillStyle = radial(g, -3, -6, 16, ['#f0ffe0', '#a8ff7a', '#3c8a2a']);
    g.beginPath(); g.moveTo(-12, 4); g.quadraticCurveTo(-13, -13, 0, -13); g.quadraticCurveTo(13, -13, 12, 4); g.quadraticCurveTo(0, 8, -12, 4); g.fill();
    g.shadowBlur = 0; g.strokeStyle = 'rgba(20,60,20,0.55)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, -13); g.lineTo(0, 5); g.moveTo(-11, -3); g.quadraticCurveTo(0, -7, 11, -3); g.stroke();
    eye(g, -3, 8, 1.5, 1.7, '#0c2a0a'); eye(g, 3, 8, 1.5, 1.7, '#0c2a0a');
  },
  ghost(g, f) {
    const w = f ? 2 : -2;
    g.fillStyle = radial(g, -3, -6, 16, ['#ffffff', '#cfe0ff', '#6c7fd6']);
    g.beginPath(); g.moveTo(-10, 6); g.lineTo(-10, -4); g.quadraticCurveTo(-10, -13, 0, -13); g.quadraticCurveTo(10, -13, 10, -4); g.lineTo(10, 6);
    g.quadraticCurveTo(8, 10 + w, 5, 6); g.quadraticCurveTo(2.5, 10 - w, 0, 6); g.quadraticCurveTo(-2.5, 10 + w, -5, 6); g.quadraticCurveTo(-8, 10 - w, -10, 6);
    g.fill();
    eye(g, -4, -4, 2.4, 3.2, '#1a1f4a'); eye(g, 4, -4, 2.4, 3.2, '#1a1f4a');
    g.shadowBlur = 0; g.fillStyle = '#1a1f4a'; g.beginPath(); g.ellipse(0, 2, 1.6, 2, 0, 0, TAU); g.fill();
  },
  splitter(g, f) {
    const sep = f ? 6 : 4.5;
    g.strokeStyle = 'rgba(255,200,150,0.7)'; g.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * 11, Math.sin(a) * 9); g.lineTo(Math.cos(a) * 15, Math.sin(a) * 12); g.stroke(); }
    for (const s of [-1, 1]) {
      g.fillStyle = radial(g, s * sep - 2, -3, 12, ['#fff0e0', '#ff9a5c', '#b04a1a']);
      g.beginPath(); g.arc(s * sep, 0, 8, 0, TAU); g.fill();
    }
    g.shadowBlur = 0; g.strokeStyle = 'rgba(255,230,200,0.7)'; g.beginPath(); g.moveTo(0, -6); g.lineTo(0, 6); g.stroke();
    eye(g, -sep, 1, 1.8, 2.2, '#3a1206'); eye(g, sep, 1, 1.8, 2.2, '#3a1206');
  },
  mini(g, f) {
    g.fillStyle = radial(g, -2, -2, 9, ['#fff0e0', '#ffb27a', '#b04a1a']);
    g.beginPath(); g.arc(0, 0, f ? 6.5 : 6, 0, TAU); g.fill();
    eye(g, 0, 1, 2, 2.4, '#3a1206');
  },
  boss(g, f) {
    g.fillStyle = 'rgba(255,120,200,0.45)';
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * 20, -10);
      g.bezierCurveTo(s * 55, f ? -36 : -28, s * 64, f ? -4 : 2, s * 52, f ? 14 : 20);
      g.quadraticCurveTo(s * 36, 10, s * 20, 12); g.closePath(); g.fill();
    }
    g.fillStyle = '#7a3a9a';
    for (const s of [-1, 1]) { g.beginPath(); g.roundRect ? g.roundRect(s * 44 - 5, 8, 10, 16, 3) : g.rect(s * 44 - 5, 8, 10, 16); g.fill(); }
    g.fillStyle = '#ffd36e';
    g.beginPath(); g.moveTo(-24, -14);
    [[-20, -34], [-12, -20], [-6, -40], [0, -22], [6, -40], [12, -20], [20, -34], [24, -14]].forEach(([x, y]) => g.lineTo(x, y));
    g.closePath(); g.fill();
    g.fillStyle = radial(g, -10, -12, 50, ['#fde6ff', '#c77dff', '#4a1d7a']);
    g.beginPath(); g.ellipse(0, 0, 36, 25, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(0, 0, 28, 18, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    g.fillStyle = radial(g, 0, 8, 14, [f ? '#ffffff' : '#ffd0ea', '#ff4f9a', 'rgba(255,79,154,0)']);
    g.beginPath(); g.arc(0, 8, f ? 14 : 12, 0, TAU); g.fill();
    eye(g, -15, -5, 4, 5, '#250a3a'); eye(g, 15, -5, 4, 5, '#250a3a');
    g.strokeStyle = '#ffb3e0'; g.lineWidth = 3; g.lineCap = 'round';
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 10, 20); g.quadraticCurveTo(s * 14, 30, s * (f ? 6 : 9), 36); g.stroke(); }
  },
};

const TYPES = {
  drone:   { color: '#5ef2ff', pts: 30, dive: 60,  size: 44, r: 14, name: 'Drone' },
  stinger: { color: '#b48cff', pts: 40, dive: 80,  size: 44, r: 14, name: 'Ferrão' },
  warden:  { color: '#ff7ad9', pts: 50, dive: 100, size: 44, r: 15, name: 'Guardião' },
  monarch: { color: '#ffd36e', pts: 60, dive: 150, size: 60, r: 18, name: 'Monarca' },
  shell:   { color: '#a8ff7a', pts: 50, dive: 100, size: 44, r: 15, hp: 2, name: 'Casco' },
  ghost:   { color: '#cfe0ff', pts: 60, dive: 120, size: 44, r: 14, name: 'Fantasma' },
  splitter:{ color: '#ff9a5c', pts: 50, dive: 100, size: 44, r: 15, name: 'Divisor' },
  mini:    { color: '#ffb27a', pts: 20, dive: 20,  size: 30, r: 10, name: 'Fragmento' },
  boss:    { color: '#e08bff', pts: 0,  dive: 0,   size: 150, r: 40, rx: 50, ry: 30, name: 'Mãe-Colmeia' },
};
for (const k in TYPES) TYPES[k].spr = [0, 1].map(f => sprite(TYPES[k].size, TYPES[k].color, g => ART[k](g, f)));
TYPES.shell.cracked = [0, 1].map(f => sprite(44, '#a8ff7a', g => {
  ART.shell(g, f);
  g.shadowBlur = 0; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.3;
  g.beginPath(); g.moveTo(-7, -11); g.lineTo(-4, -6); g.lineTo(-8, -2); g.lineTo(-5, 3);
  g.moveTo(6, -12); g.lineTo(3, -7); g.lineTo(7, -3); g.stroke();
}));

const SHIP = sprite(52, '#6fd8ff', g => {
  const wg = g.createLinearGradient(0, -6, 0, 16); wg.addColorStop(0, '#9ff0ff'); wg.addColorStop(1, '#2a5cff');
  g.fillStyle = wg;
  g.beginPath(); g.moveTo(0, -6); g.lineTo(19, 11); g.lineTo(16, 16); g.lineTo(4, 11); g.lineTo(-4, 11); g.lineTo(-16, 16); g.lineTo(-19, 11); g.closePath(); g.fill();
  const fg = g.createLinearGradient(0, -21, 0, 13); fg.addColorStop(0, '#ffffff'); fg.addColorStop(0.5, '#c9efff'); fg.addColorStop(1, '#4d7cff');
  g.fillStyle = fg;
  g.beginPath(); g.moveTo(0, -21); g.quadraticCurveTo(6.5, -6, 5, 12); g.lineTo(-5, 12); g.quadraticCurveTo(-6.5, -6, 0, -21); g.fill();
  g.shadowBlur = 4; g.fillStyle = radial(g, 0, -7, 6, ['#ffffff', '#58e6ff', '#1a4fae']);
  g.beginPath(); g.ellipse(0, -5, 2.6, 5.5, 0, 0, TAU); g.fill();
  g.fillStyle = '#ff8ad8'; g.beginPath(); g.arc(17.5, 12.5, 1.5, 0, TAU); g.arc(-17.5, 12.5, 1.5, 0, TAU); g.fill();
});

// ------------------------------------------------------ fundo / nebulosa ---
const PALETTES = [[255, 205, 320], [200, 170, 260], [300, 335, 250], [185, 220, 150], [20, 330, 275], [230, 280, 190]];
function makeNebula(hues) {
  const c = makeCanvas(300, 400), g = c.getContext('2d');
  for (let i = 0; i < 10; i++) {
    const x = rand(-20, 320), y = rand(-20, 420), r = rand(60, 180), h = pick(hues);
    g.fillStyle = radial(g, x, y, r, [`hsla(${h},80%,62%,0.22)`, `hsla(${h},70%,45%,0.08)`, `hsla(${h},70%,40%,0)`]);
    g.fillRect(0, 0, 300, 400);
  }
  for (let i = 0; i < 40; i++) { // poeira estelar
    g.fillStyle = `hsla(${pick(hues)},80%,85%,${rand(0.1, 0.35)})`;
    g.fillRect(rand(0, 300), rand(0, 400), 1, 1);
  }
  const ph = pick(hues);
  c.planet = { x: rand(0.1, 0.9) > 0.5 ? rand(430, 560) : rand(40, 170), y: rand(480, 720), r: rand(40, 90), h: ph };
  return c;
}
let neb = makeNebula(PALETTES[0]), nebPrev = null, nebFade = 1;
function setNebula(wave) { nebPrev = neb; neb = makeNebula(PALETTES[(wave - 1) % PALETTES.length]); nebFade = 0; }

const stars = [];
[[70, 8, 0.8, 0.45], [45, 22, 1.3, 0.7], [18, 55, 2, 1]].forEach(([n, sp, sz, al]) => {
  for (let i = 0; i < n; i++) stars.push({ x: rand(0, W), y: rand(0, H), sp, sz, al, ph: rand(0, TAU), hue: pick([200, 220, 260, 300, 40]) });
});

// --------------------------------------------------------------- estado ---
let state = 'menu';           // menu | playing | paused | over
let time = 0, overAt = 0;
let best = store.get('best', 0);
let totalDust = store.get('dust', 0);
let game = null, newRecord = false;
let warp = 1;
const player = { x: W / 2, y: H - 72, vx: 0, alive: true, inv: 0, respawn: 0, cool: 0, shield: 0, twin: 0, slow: 0 };
const keys = { left: false, right: false, fire: false };
const pointer = { down: false, id: null, lastX: 0, target: null };

const LAYOUT = [
  ['monarch', [3, 6]],
  ['warden', [2, 3, 4, 5, 6, 7]],
  ['stinger', [1, 2, 3, 4, 5, 6, 7, 8]],
  ['drone', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
  ['drone', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
  ['drone', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
];
const COLW = 46, ROWH = 40, TOP = 118;

// cada setor = 3 ondas normais, 1 fase bônus, 1 chefão
const SHAPES = {
  classic: ['...X..X...', '..XXXXXX..', '.XXXXXXXX.', 'XXXXXXXXXX', 'XXXXXXXXXX', 'XXXXXXXXXX'],
  wings:   ['..X....X..', '.XXX..XXX.', 'XXXX..XXXX', 'XXXX..XXXX', '.XXX..XXX.', '..XX..XX..'],
  diamond: ['....XX....', '...XXXX...', '..XXXXXX..', '.XXXXXXXX.', '..XXXXXX..', '...XXXX...'],
  columns: ['...X..X...', '.XX.XX.XX.', '.XX.XX.XX.', 'XXX.XX.XXX', 'XXX.XX.XXX', 'XXX.XX.XXX'],
  arrow:   ['....XX....', '...XXXX...', '..XX..XX..', '.XXX..XXX.', 'XXX....XXX', 'XX......XX'],
};
const SHAPE_ORDER = ['classic', 'wings', 'diamond', 'columns', 'arrow'];
const NEW_IN = {
  2: ['Casco', 'precisa de 2 tiros'],
  3: ['Fantasma', 'só leva dano quando está visível'],
  4: ['Divisor', 'se parte em dois ao ser destruído'],
};
function rowType(row, col, sector) {
  let t = ['monarch', 'warden', 'stinger', 'drone', 'drone', 'drone'][row];
  if (sector >= 2 && row === 3) t = 'shell';
  if (sector >= 3 && row === 2 && col % 2 === 0) t = 'ghost';
  if (sector >= 4 && row === 4) t = 'splitter';
  if (sector >= 5 && row === 5 && Math.random() < 0.45) t = pick(['shell', 'ghost', 'splitter']);
  return t;
}
function makeAlien(type, row, col) {
  const a = { type, row, col, state: 'entering', delay: 0.4 + row * 0.16 + Math.abs(col - 4.5) * 0.05, e: 0, rot: 0,
    anim: rand(0, 2), dead: false, hp: TYPES[type].hp || 1, gOff: rand(0, TAU), flash: 0 };
  a.sx = W / 2 + (col - 4.5) * 34 + (col < 5 ? -120 : 120); a.sy = -50 - row * 26;
  a.x = a.sx; a.y = a.sy;
  return a;
}
function makeMini(x, y, angle) {
  return { type: 'mini', state: 'diving', phase: 'attack', pattern: 'loop', pt: 0, angle, speed: 220 + game.wave * 4,
    weave: rand(20, 60), weaveF: 2, steer: 2.2, shots: [], noReturn: true, x, y, rot: 0, anim: 0, dead: false, hp: 1, flash: 0 };
}
function ghostAlpha(a) { return clamp(0.18 + (Math.sin(time * 1.5 + a.gOff) + 0.45) * 3, 0.18, 1); }

function buildFormation(g) {
  g.normalCount = (g.normalCount || 0) + 1;
  const shape = SHAPES[SHAPE_ORDER[(g.normalCount - 1) % SHAPE_ORDER.length]];
  shape.forEach((line, row) => [...line].forEach((ch, col) => { if (ch === 'X') g.aliens.push(makeAlien(rowType(row, col, g.sector), row, col)); }));
}
const STREAMS = [
  { x: -30, y: 190, a: 0, seg: [[0.7, 0], [2.1, 3.0], [0.5, 0], [1.6, -2.0]] },
  { x: 170, y: -30, a: Math.PI / 2, seg: [[0.9, 0], [1.5, -3.0], [0.8, 0], [1.2, 2.5]] },
  { x: -30, y: 430, a: -0.5, seg: [[0.6, 0], [2.4, -2.6]] },
  { x: 300, y: -30, a: Math.PI / 2, seg: [[0.8, 0], [2.2, 2.9]] },
  { x: -30, y: 300, a: 0.2, seg: [[1.0, 0], [1.8, -3.4], [0.4, 0], [1.8, 3.4]] },
];
function buildBonus(g) {
  const kinds = g.sector >= 2 ? ['drone', 'shell', 'warden', 'stinger', 'monarch'] : ['drone', 'stinger', 'warden', 'drone', 'monarch'];
  STREAMS.forEach((sc, gi) => {
    const mirror = (gi + g.sector) % 2 === 1;
    for (let i = 0; i < 8; i++) g.aliens.push({
      type: kinds[gi], state: 'stream', delay: 0.8 + gi * 3.3 + i * 0.16, x: mirror ? W - sc.x : sc.x, y: sc.y,
      angle: mirror ? Math.PI - sc.a : sc.a, seg: sc.seg, mirror, segI: 0, segT: 0, pt: 0, speed: 250 + g.sector * 10,
      rot: 0, anim: rand(0, 2), dead: false, hp: 1, flash: 0,
    });
  });
  g.bonusTotal = 40; g.bonusHits = 0;
}
function buildBoss(g) {
  const hp = 30 + g.sector * 12;
  g.boss = { type: 'boss', state: 'boss', x: W / 2, y: -100, e: 0, bt: 0, atk: 2.2, atkI: 0, hp, maxHp: hp, rot: 0, anim: 0, dead: false, flash: 0, burst: 0, burstT: 0 };
  g.aliens.push(g.boss);
}

function slotPos(a, formX, formT) {
  const breath = 1 + 0.035 * Math.sin(formT * 1.3);
  return { x: W / 2 + (a.col - 4.5) * COLW * breath + formX, y: TOP + a.row * ROWH + Math.sin(formT * 1.7 + a.col * 0.6) * 2 };
}

function newGame() {
  game = {
    score: 0, lives: 3, wave: 0, nextLife: 10000, combo: 0, comboT: 0, dustRun: 0,
    aliens: [], pb: [], eb: [], parts: [], rings: [], texts: [], powers: [], dust: [],
    formX: 0, formT: 0, diveTimer: 3, banner: 0, bannerText: '', clearT: 0, overT: 0, shake: 0, flash: 0,
  };
  Object.assign(player, { x: W / 2, vx: 0, alive: true, inv: 2, respawn: 0, cool: 0, shield: 0, twin: 0, slow: 0 });
  pointer.target = null;
  newRecord = false;
  nextWave();
  state = 'playing';
}

function nextWave() {
  const g = game;
  g.wave++; g.aliens = []; g.eb = []; g.boss = null;
  g.sector = Math.ceil(g.wave / 5);
  const ws = (g.wave - 1) % 5 + 1;
  g.kind = ws === 4 ? 'bonus' : ws === 5 ? 'boss' : 'normal';
  if (g.kind === 'normal') buildFormation(g); else if (g.kind === 'bonus') buildBonus(g); else buildBoss(g);
  g.bannerText = g.kind === 'bonus' ? 'FASE BÔNUS' : g.kind === 'boss' ? 'CHEFÃO' : 'ONDA ' + g.wave;
  g.bannerSub = g.kind === 'bonus' ? 'eles não atiram: derrube o máximo que puder'
    : g.kind === 'boss' ? 'Mãe-Colmeia · setor ' + g.sector : 'prepare-se';
  if (ws === 1 && g.wave > 1) {
    const n = NEW_IN[g.sector];
    g.bannerText = 'SETOR ' + g.sector;
    g.bannerSub = n ? `novo inimigo: ${n[0]} (${n[1]})` : 'os inimigos estão mais fortes';
  }
  g.diveTimer = 2.5; g.banner = g.bannerMax = ws === 1 && g.wave > 1 ? 3.8 : 2.6;
  if (g.wave > 1) setNebula(g.wave);
  Sound.wave();
}

// ------------------------------------------------------------ mergulhos ---
function startDive(a, quiet) {
  a.state = 'diving'; a.phase = 'loop'; a.pt = 0; a.loopAcc = 0;
  a.angle = -Math.PI / 2; a.dir = a.col < 4.5 ? -1 : 1;
  a.speed = 150 + game.wave * 6; a.turnR = rand(2.8, 3.4);
  a.weave = rand(40, 90); a.weaveF = rand(1.5, 2.6); a.steer = 1.9;
  const pats = ['loop'];
  if (game.wave >= 3) pats.push('zigzag');
  if (game.wave >= 7) pats.push('hook');
  if (game.wave >= 11) pats.push('kamikaze');
  a.pattern = a.type === 'monarch' ? 'loop' : pick(pats);
  if (a.pattern === 'zigzag') { a.weave = rand(120, 160); a.weaveF = rand(3.0, 3.8); a.steer = 3.0; }
  if (a.pattern === 'kamikaze') a.phase = 'windup';
  const n = Math.min(1 + Math.floor(game.wave / 2), 4);
  a.shots = []; for (let i = 0; i < n; i++) a.shots.push(rand(0.15, 1.6));
  a.shots.sort((p, q) => p - q);
  if (!quiet) Sound.dive();
}

function updateDiveScheduler(dt) {
  const g = game;
  if (!player.alive || g.clearT > 0 || g.kind !== 'normal') return;
  if (g.aliens.some(a => a.state === 'entering')) return;
  const inForm = g.aliens.filter(a => a.state === 'formation');
  const divers = g.aliens.length - inForm.length;
  const few = g.aliens.length <= 5;
  g.diveTimer -= dt;
  if (g.diveTimer > 0 || !inForm.length) return;
  if (divers >= (few ? 99 : Math.min(2 + Math.floor(g.wave / 2), 7))) return;
  g.diveTimer = few ? rand(0.3, 0.8) : Math.max(0.55, rand(1.5, 2.8) - g.wave * 0.12);

  const monarchs = inForm.filter(a => a.type === 'monarch');
  if (monarchs.length && Math.random() < 0.3) {
    const m = pick(monarchs);
    const esc = inForm.filter(a => a.type === 'warden' && Math.abs(a.col - m.col) <= 1).slice(0, 2);
    startDive(m);
    m.escorts = esc; m.escortTotal = esc.length;
    esc.forEach(e => { startDive(e, true); Object.assign(e, { pattern: 'loop', phase: 'loop', dir: m.dir, turnR: m.turnR, weave: m.weave, weaveF: m.weaveF, steer: m.steer }); });
  } else {
    const sorted = inForm.slice().sort((p, q) => Math.abs(q.col - 4.5) - Math.abs(p.col - 4.5) + rand(-1.5, 1.5));
    startDive(sorted[Math.floor(Math.random() * Math.min(5, sorted.length))]);
  }
}

function updateAlien(a, dt, g) {
  a.anim += dt;
  if (a.state === 'formation') {
    const s = slotPos(a, g.formX, g.formT); a.x = s.x; a.y = s.y;
    a.rot = angDiff(0, a.rot) * Math.max(0, 1 - dt * 6);
  } else if (a.state === 'entering') {
    if (a.delay > 0) { a.delay -= dt; return; }
    a.e = Math.min(1, a.e + dt * 0.75);
    const s = slotPos(a, g.formX, g.formT), k = easeOut(a.e);
    a.x = lerp(a.sx, s.x, k) + Math.sin(a.e * Math.PI) * (a.col < 5 ? 60 : -60);
    a.y = lerp(a.sy, s.y, k);
    if (a.e >= 1) a.state = 'formation';
  } else if (a.state === 'diving') {
    a.pt += dt;
    if (a.phase === 'windup') {
      a.y -= 25 * dt; a.rot = Math.sin(a.pt * 40) * 0.2;
      if (a.pt > 0.6) {
        a.phase = 'dash';
        a.angle = Math.atan2(player.y - a.y, (player.alive ? player.x : W / 2) - a.x);
        a.speed = 360 + g.wave * 6;
      }
      return;
    }
    if (a.phase === 'loop') {
      a.angle += a.dir * a.turnR * dt; a.loopAcc += a.turnR * dt;
      if (a.loopAcc >= Math.PI) { a.phase = 'attack'; a.pt = 0; }
    } else if (a.phase === 'climb') {
      a.angle += clamp(angDiff(a.angle, -Math.PI / 2), -3.2 * dt, 3.2 * dt);
      if (Math.abs(angDiff(a.angle, -Math.PI / 2)) < 0.2) { a.state = 'returning'; a.escorts = null; }
    } else if (a.phase === 'attack') {
      const tx = (player.alive ? player.x : W / 2) + Math.sin(a.pt * a.weaveF) * a.weave;
      const desired = Math.atan2(H + 80 - a.y, tx - a.x);
      a.angle += clamp(angDiff(a.angle, desired), -a.steer * dt, a.steer * dt);
      a.speed = Math.min(a.speed + 70 * dt, 265 + g.wave * 8);
      while (a.shots.length && a.pt >= a.shots[0]) {
        a.shots.shift();
        if (a.y > 40 && a.y < H - 230 && player.alive) enemyShoot(a);
      }
      if (a.pattern === 'hook' && a.y > H - 290) a.phase = 'climb';
    }
    a.x += Math.cos(a.angle) * a.speed * dt;
    a.y += Math.sin(a.angle) * a.speed * dt;
    a.rot = a.angle - Math.PI / 2;
    if (a.y > H + 40 || a.x < -70 || a.x > W + 70) {
      if (a.noReturn) { a.dead = true; return; }
      a.y = -40; a.x = slotPos(a, g.formX, g.formT).x; a.state = 'returning'; a.escorts = null; a.rot = 0;
    }
  } else if (a.state === 'stream') {
    if (a.delay > 0) { a.delay -= dt; return; }
    a.pt += dt;
    const seg = a.seg[a.segI];
    if (seg) { a.segT += dt; a.angle += seg[1] * (a.mirror ? -1 : 1) * dt; if (a.segT >= seg[0]) { a.segI++; a.segT = 0; } }
    a.x += Math.cos(a.angle) * a.speed * dt;
    a.y += Math.sin(a.angle) * a.speed * dt;
    a.rot = a.angle - Math.PI / 2;
    if (a.pt > 1 && (a.x < -70 || a.x > W + 70 || a.y < -70 || a.y > H + 70)) a.dead = true;
  } else if (a.state === 'boss') {
    updateBoss(a, dt, g);
  } else if (a.state === 'returning') {
    const s = slotPos(a, g.formX, g.formT), dx = s.x - a.x, dy = s.y - a.y, d = Math.hypot(dx, dy), v = 210 * dt;
    if (d <= v + 1) { a.x = s.x; a.y = s.y; a.state = 'formation'; }
    else { a.x += dx / d * v; a.y += dy / d * v; }
    a.rot = angDiff(0, a.rot) * Math.max(0, 1 - dt * 5);
  }
}

function updateBoss(a, dt, g) {
  a.flash = Math.max(0, a.flash - dt);
  if (a.e < 1) { a.e = Math.min(1, a.e + dt * 0.4); a.y = lerp(-100, 170, easeOut(a.e)); return; }
  a.bt += dt;
  a.x = W / 2 + Math.sin(a.bt * 0.55) * 170;
  a.y = 170 + Math.sin(a.bt * 1.1) * 22;
  const rage = a.hp < a.maxHp * 0.4;
  if (a.burst > 0) {
    a.burstT -= dt;
    if (a.burstT <= 0) {
      a.burst--; a.burstT = 0.14;
      const ang = Math.atan2(player.y - a.y, player.x - a.x);
      g.eb.push({ x: a.x, y: a.y + 30, vx: Math.cos(ang) * 300, vy: Math.sin(ang) * 300 });
      Sound.bossShot();
    }
  }
  a.atk -= dt * (rage ? 1.5 : 1);
  if (a.atk > 0 || !player.alive) return;
  a.atk = Math.max(1.0, 2.3 - g.sector * 0.15);
  const pat = ['fan', 'aim', 'spawn', 'fan', 'aim', g.sector >= 2 ? 'rain' : 'aim'][a.atkI++ % 6];
  if (pat === 'fan') {
    const n = 5 + Math.min(g.sector, 4);
    for (let i = 0; i < n; i++) {
      const ang = Math.PI / 2 + (i / (n - 1) - 0.5) * 1.1;
      g.eb.push({ x: a.x, y: a.y + 30, vx: Math.cos(ang) * 210, vy: Math.sin(ang) * 210 });
    }
    Sound.bossShot();
  } else if (pat === 'aim') { a.burst = 3 + Math.min(g.sector, 3); a.burstT = 0; }
  else if (pat === 'spawn') {
    if (g.aliens.filter(x => x.type === 'mini').length < 6)
      for (const s of [-1, 1]) g.aliens.push(makeMini(a.x + s * 44, a.y + 24, Math.PI / 2 + s * 0.35));
  } else {
    for (let i = 0; i < 8; i++) g.eb.push({ x: a.x + rand(-40, 40), y: a.y + 20, vx: rand(-140, 140), vy: rand(160, 240) });
    Sound.bossShot();
  }
}

function enemyShoot(a) {
  game.eb.push({ x: a.x, y: a.y + 10, vx: clamp((player.x - a.x) * 0.35, -110, 110), vy: 255 + game.wave * 12 });
}

// ------------------------------------------------------------- jogador ---
function fire() {
  const max = player.twin > 0 ? 4 : 2;
  if (game.pb.length >= max) return;
  player.cool = 0.19;
  if (player.twin > 0) { game.pb.push({ x: player.x - 9, y: player.y - 14 }, { x: player.x + 9, y: player.y - 14 }); }
  else game.pb.push({ x: player.x, y: player.y - 20 });
  Sound.shoot();
}

function updatePlayer(dt) {
  if (player.alive) {
    const dir = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
    if (dir) pointer.target = null;
    if (pointer.target !== null) {
      const nx = lerp(player.x, pointer.target, Math.min(1, dt * 16));
      player.vx = (nx - player.x) / Math.max(dt, 1e-4); player.x = nx;
    } else {
      player.vx = lerp(player.vx, dir * 430, Math.min(1, dt * 14));
      player.x += player.vx * dt;
    }
    player.x = clamp(player.x, 24, W - 24);
    player.cool -= dt;
    if ((keys.fire || pointer.down) && player.cool <= 0 && game.overT <= 0) fire();
    player.inv = Math.max(0, player.inv - dt);
    player.twin = Math.max(0, player.twin - dt);
    player.slow = Math.max(0, player.slow - dt);
    player.shield = Math.max(0, player.shield - dt);
  } else if (game.lives > 0) {
    player.respawn -= dt;
    if (player.respawn <= 0) {
      Object.assign(player, { alive: true, inv: 2.5, x: W / 2, vx: 0 });
      pointer.target = pointer.down ? player.x : null;
    }
  }
}

function hitPlayer() {
  const g = game;
  if (player.shield > 0) {
    player.shield = 0; player.inv = 1.2; Sound.shield();
    g.rings.push({ x: player.x, y: player.y, r: 20, life: 0.6, max: 0.6, color: '#7cf7ff' });
    return;
  }
  player.alive = false; g.lives--;
  explode(player.x, player.y, '#9ff0ff', 2.2);
  explode(player.x, player.y, '#ffffff', 1);
  g.shake = 14; g.flash = 0.5; g.combo = 0; g.comboT = 0;
  player.twin = player.slow = player.shield = 0;
  player.respawn = 2.4;
  Sound.hurt();
  if (g.lives <= 0) g.overT = 2.6;
}

// ----------------------------------------------------- pontos e efeitos ---
function addText(x, y, text, color, size = 16) { game.texts.push({ x, y, text, color, size, t: 1.1, max: 1.1 }); }
function addScore(p) {
  const g = game; g.score += p;
  if (g.score >= g.nextLife) { g.lives++; g.nextLife += 10000; addText(W / 2, H / 2, '+1 VIDA', '#9effa8', 28); Sound.power(); }
}
function explode(x, y, color, power = 1) {
  const g = game, n = Math.round(16 * power);
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(40, 240) * Math.sqrt(power);
    g.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.35, 0.9), max: 0.9, color: Math.random() < 0.25 ? '#ffffff' : color, size: rand(1.5, 3.2) });
  }
  g.rings.push({ x, y, r: 6, life: 0.45, max: 0.45, color, grow: 140 * power });
}

const POWERS = {
  twin:   { color: '#7cf7ff', label: 'TIRO DUPLO' },
  shield: { color: '#9effa8', label: 'ESCUDO' },
  slow:   { color: '#ffb86b', label: 'TEMPO LENTO' },
};

function hitAlien(a) {
  if (a.hp > 1) {
    a.hp--; a.flash = 0.12;
    const g = game;
    for (let i = 0; i < 6; i++) { const an = rand(0, TAU), sp = rand(60, 160); g.parts.push({ x: a.x, y: a.y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, life: 0.3, max: 0.3, color: '#ffffff', size: 2 }); }
    if (a.type === 'boss') { if (Math.random() < 0.5) Sound.clink(); if (a.hp % 10 === 0) addScore(50); }
    else { Sound.clink(); addScore(10); }
    return;
  }
  killAlien(a);
}

function killBoss(a) {
  const g = game, pts = 2000 * g.sector;
  addScore(pts);
  for (let i = 0; i < 6; i++) explode(a.x + rand(-45, 45), a.y + rand(-25, 25), pick(['#e08bff', '#ffd36e', '#ff4f9a', '#ffffff']), 1.6);
  explode(a.x, a.y, '#ffffff', 3);
  addText(a.x, a.y - 50, 'MÃE-COLMEIA DERROTADA', '#ffd36e', 24);
  addText(a.x, a.y - 20, '+' + fmt(pts), '#ffffff', 22);
  g.shake = 20; g.flash = 0.6; Sound.boom(true); Sound.power();
  for (let i = 0; i < 30; i++) g.dust.push({ x: a.x + rand(-30, 30), y: a.y, vx: rand(-160, 160), vy: rand(-200, 40), t: 0 });
  g.powers.push({ x: a.x, y: a.y, type: pick(Object.keys(POWERS)), t: 0 });
  a.dead = true; g.boss = null;
}

function killAlien(a) {
  if (a.type === 'boss') return killBoss(a);
  const g = game, T = TYPES[a.type];
  const diving = a.state === 'diving' || a.state === 'returning';
  let pts = a.state === 'stream' ? 100 : diving ? T.dive : T.pts, bonus = false;
  if (a.state === 'stream') g.bonusHits++;
  if (a.type === 'splitter') for (const s of [-1, 1]) g.aliens.push(makeMini(a.x + s * 8, a.y, Math.PI / 2 + s * 0.5));
  if (a.type === 'monarch' && diving && a.escortTotal) {
    const alive = (a.escorts || []).filter(e => !e.dead && e.state === 'diving').length;
    const k = a.escortTotal - alive;
    pts = k >= 2 ? 800 : k === 1 ? 300 : 150; bonus = k > 0;
  }
  g.combo = g.comboT > 0 ? g.combo + 1 : 1; g.comboT = 1.6;
  pts = Math.round(pts * (1 + Math.min(g.combo - 1, 10) * 0.1) / 10) * 10;
  addScore(pts);
  addText(a.x, a.y - 8, (bonus ? 'BÔNUS ' : '') + pts, bonus ? '#ffd36e' : T.color, bonus ? 22 : 15);
  if (g.combo >= 3 && g.combo % 3 === 0) addText(a.x, a.y - 30, 'COMBO x' + g.combo, '#ffffff', 18);
  const big = a.type === 'monarch';
  explode(a.x, a.y, T.color, big ? 2 : 1);
  Sound.boom(big);
  if (big) g.shake = Math.max(g.shake, 6);
  const nd = big ? 8 : diving ? 3 : 1;
  for (let i = 0; i < nd; i++) g.dust.push({ x: a.x, y: a.y, vx: rand(-90, 90), vy: rand(-140, 20), t: 0 });
  const chance = big ? 0.55 : diving ? 0.09 : 0.025;
  if (!g.powers.length && Math.random() < chance) g.powers.push({ x: a.x, y: a.y, type: pick(Object.keys(POWERS)), t: 0 });
  a.dead = true;
}

// --------------------------------------------------------------- update ---
function updateGame(dt) {
  const g = game;
  const sp = player.slow > 0 ? 0.45 : 1, edt = dt * sp;
  g.formT += edt; g.formX = Math.sin(g.formT * 0.55) * 48;

  updatePlayer(dt);
  updateDiveScheduler(edt);
  for (const a of g.aliens) { updateAlien(a, edt, g); if (a.flash > 0 && a.type !== 'boss') a.flash -= edt; }

  // tiros do jogador
  for (const b of g.pb) {
    b.y -= 840 * dt;
    if (b.y < -20) { b.dead = true; continue; }
    for (const a of g.aliens) {
      if (a.dead || ((a.state === 'entering' || a.state === 'stream') && (a.delay > 0 || a.y < 20))) continue;
      if (a.type === 'ghost' && ghostAlpha(a) < 0.6) continue;
      const T = TYPES[a.type], rx = T.rx || T.r, ry = T.ry || T.r;
      if (Math.abs(b.x - a.x) < rx && Math.abs(b.y - a.y) < ry) { b.dead = true; hitAlien(a); break; }
    }
  }
  // inimigos x jogador
  if (player.alive && player.inv <= 0) {
    for (const a of g.aliens) {
      if (a.dead || a.state !== 'diving') continue;
      if (Math.hypot(a.x - player.x, a.y - player.y) < 22) { killAlien(a); hitPlayer(); break; }
    }
  }
  // tiros inimigos
  for (const b of g.eb) {
    b.x += b.vx * edt; b.y += b.vy * edt;
    if (b.y > H + 20) b.dead = true;
    else if (player.alive && player.inv <= 0 && Math.abs(b.x - player.x) < 11 && Math.abs(b.y - player.y) < 14) { b.dead = true; hitPlayer(); }
  }
  g.pb = g.pb.filter(b => !b.dead);
  g.eb = g.eb.filter(b => !b.dead);
  g.aliens = g.aliens.filter(a => !a.dead);

  // poeira estelar (moeda)
  for (const d of g.dust) {
    d.t += dt;
    if (d.t < 0.35 || !player.alive) { d.vx *= 1 - dt * 3; d.vy += 60 * dt; }
    else {
      const dx = player.x - d.x, dy = player.y - d.y, dist = Math.hypot(dx, dy) || 1;
      const acc = 1600 + d.t * 1200;
      d.vx += dx / dist * acc * dt; d.vy += dy / dist * acc * dt;
      d.vx *= 1 - dt * 4; d.vy *= 1 - dt * 4;
      if (dist < 22) { d.dead = true; g.dustRun++; Sound.dust(); }
    }
    d.x += d.vx * dt; d.y += d.vy * dt;
    if (d.y > H + 20 || d.t > 6) d.dead = true;
  }
  g.dust = g.dust.filter(d => !d.dead);

  // power-ups
  for (const p of g.powers) {
    p.t += dt; p.y += 95 * dt; p.x += Math.sin(p.t * 3) * 30 * dt;
    if (player.alive && Math.hypot(p.x - player.x, p.y - player.y) < 30) {
      p.dead = true;
      if (p.type === 'twin') player.twin = 12;
      if (p.type === 'shield') player.shield = 20;
      if (p.type === 'slow') player.slow = 6;
      addText(player.x, player.y - 40, POWERS[p.type].label, POWERS[p.type].color, 20);
      g.rings.push({ x: player.x, y: player.y, r: 10, life: 0.5, max: 0.5, color: POWERS[p.type].color, grow: 160 });
      Sound.power();
    }
    if (p.y > H + 30) p.dead = true;
  }
  g.powers = g.powers.filter(p => !p.dead);

  updateFx(dt);

  g.comboT = Math.max(0, g.comboT - dt);
  if (g.comboT === 0) g.combo = 0;
  g.banner = Math.max(0, g.banner - dt);
  g.flash = Math.max(0, g.flash - dt);
  g.shake *= Math.exp(-dt * 7);

  // fim de onda
  if (!g.aliens.length && g.overT <= 0) {
    if (g.clearT <= 0) {
      g.clearT = 2.4; g.eb = [];
      if (g.kind === 'bonus') {
        const perfect = g.bonusHits === g.bonusTotal;
        addText(W / 2, H / 2 - 60, `${g.bonusHits} de ${g.bonusTotal} abatidos`, '#ffffff', 28);
        if (perfect) { addScore(5000); addText(W / 2, H / 2 - 20, 'PERFEITO! +5.000', '#ffd36e', 26); Sound.power(); }
        g.clearT = 3;
      } else if (g.kind === 'normal') addText(W / 2, H / 2 - 40, 'ONDA COMPLETA', '#ffffff', 30);
    }
    else { g.clearT -= dt; if (g.clearT <= 0) nextWave(); }
  }
  // fim de jogo
  if (g.overT > 0) {
    g.overT -= dt;
    if (g.overT <= 0) {
      state = 'over'; overAt = time;
      if (g.score > best) { best = g.score; newRecord = true; store.set('best', best); }
      totalDust += g.dustRun; store.set('dust', totalDust);
    }
  }
}

function updateFx(dt) {
  const g = game;
  for (const p of g.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 2.2; p.vy *= 1 - dt * 2.2; p.life -= dt; }
  g.parts = g.parts.filter(p => p.life > 0);
  for (const r of g.rings) { r.r += (r.grow || 120) * dt; r.life -= dt; }
  g.rings = g.rings.filter(r => r.life > 0);
  for (const t of g.texts) { t.y -= 34 * dt; t.t -= dt; }
  g.texts = g.texts.filter(t => t.t > 0);
}

function updateWorld(dt) {
  const target = state === 'playing' && game && game.clearT > 0 ? 9 : 1;
  warp = lerp(warp, target, Math.min(1, dt * 2.5));
  const sdt = state === 'paused' ? dt * 0.2 : dt;
  for (const s of stars) { s.y += s.sp * warp * sdt; if (s.y > H + 10) { s.y = -10; s.x = rand(0, W); } }
  nebFade = Math.min(1, nebFade + dt / 3);
}

// --------------------------------------------------------------- render ---
function text(str, x, y, size, color, { align = 'center', weight = 700, glow = 0, alpha = 1 } = {}) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.globalAlpha = alpha;
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
  ctx.fillStyle = color; ctx.fillText(str, x, y);
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;
}

function drawNebula(c, alpha) {
  if (!c || alpha <= 0) return;
  ctx.globalAlpha = alpha;
  const p = c.planet, py = p.y + Math.sin(time * 0.05) * 10;
  ctx.fillStyle = radial(ctx, p.x - p.r * 0.35, py - p.r * 0.35, p.r * 1.3, [`hsla(${p.h},60%,55%,0.55)`, `hsla(${p.h},55%,25%,0.45)`, `hsla(${p.h},50%,8%,0.0)`]);
  ctx.beginPath(); ctx.arc(p.x, py, p.r, 0, TAU); ctx.fill();
  ctx.strokeStyle = `hsla(${p.h},80%,75%,0.18)`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(p.x, py, p.r * 1.7, p.r * 0.35, -0.3, 0, TAU); ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  const dy = Math.sin(time * 0.04) * 18, s = 1.04 + Math.sin(time * 0.03) * 0.02;
  ctx.drawImage(c, (W - W * s) / 2, dy - 20, W * s, H * s + 40);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

function drawBackground() {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#060515'); bg.addColorStop(1, '#130a30');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  drawNebula(nebPrev, 1 - nebFade);
  drawNebula(neb, nebFade);
  ctx.globalCompositeOperation = 'lighter';
  for (const s of stars) {
    const tw = 0.6 + 0.4 * Math.sin(time * 2 + s.ph);
    ctx.fillStyle = `hsla(${s.hue},90%,88%,${s.al * tw})`;
    if (warp > 1.6) {
      const len = s.sp * warp * 0.06;
      ctx.fillRect(s.x, s.y - len, s.sz * 0.8, len + s.sz);
    } else ctx.fillRect(s.x, s.y, s.sz, s.sz);
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawSprite(img, x, y, rot = 0, alpha = 1, sc = 1) {
  const s = img.size * sc;
  ctx.globalAlpha = alpha;
  if (rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(img, -s / 2, -s / 2, s, s); ctx.restore(); }
  else ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
  ctx.globalAlpha = 1;
}

function drawAliens(list, base = 1) {
  for (const a of list) {
    if ((a.state === 'entering' || a.state === 'stream') && a.delay > 0) continue;
    const T = TYPES[a.type];
    const frame = Math.floor(a.anim * (a.state === 'diving' || a.state === 'stream' ? 6 : 2.2)) % 2;
    const img = a.type === 'shell' && a.hp === 1 ? T.cracked[frame] : T.spr[frame];
    const alpha = (a.type === 'ghost' ? ghostAlpha(a) : 1) * base;
    drawSprite(img, a.x, a.y, a.rot, alpha);
    if (a.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      drawSprite(img, a.x, a.y, a.rot, 0.8);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}

function drawPlayer() {
  if (!player.alive) return;
  const blink = player.inv > 0 && Math.floor(time * 12) % 2 === 0;
  const tilt = clamp(player.vx / 430, -1, 1) * 0.18;
  // chama do motor
  ctx.globalCompositeOperation = 'lighter';
  const fl = 12 + Math.sin(time * 40) * 3 + Math.random() * 3;
  const gr = ctx.createLinearGradient(0, player.y + 10, 0, player.y + 12 + fl);
  gr.addColorStop(0, 'rgba(160,240,255,0.95)'); gr.addColorStop(1, 'rgba(80,120,255,0)');
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.moveTo(player.x - 4.5, player.y + 11); ctx.lineTo(player.x + 4.5, player.y + 11); ctx.lineTo(player.x, player.y + 12 + fl); ctx.closePath(); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  drawSprite(SHIP, player.x, player.y, tilt, blink ? 0.35 : 1);
  if (player.shield > 0) {
    const fade = player.shield < 3 ? (Math.floor(time * 8) % 2 ? 0.3 : 0.8) : 0.8;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(158,255,168,${0.55 * fade})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(player.x, player.y - 2, 30 + Math.sin(time * 5) * 1.5, 0, TAU); ctx.stroke();
    ctx.fillStyle = radial(ctx, player.x, player.y - 2, 32, ['rgba(158,255,168,0)', 'rgba(158,255,168,0)', `rgba(158,255,168,${0.18 * fade})`]);
    ctx.beginPath(); ctx.arc(player.x, player.y - 2, 32, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
}

function drawPowerIcon(type, x, y, r) {
  const col = POWERS[type].color;
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2;
  if (type === 'twin') { ctx.fillRect(x - 5, y - 6, 3, 12); ctx.fillRect(x + 2, y - 6, 3, 12); }
  else if (type === 'shield') {
    ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 6, y - 4); ctx.quadraticCurveTo(x + 6, y + 4, x, y + 8); ctx.quadraticCurveTo(x - 6, y + 4, x - 6, y - 4); ctx.closePath(); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 5); ctx.moveTo(x, y); ctx.lineTo(x + 4, y + 1); ctx.stroke();
  }
}

function drawGame() {
  const g = game;
  drawAliens(g.aliens);

  ctx.globalCompositeOperation = 'lighter';
  for (const r of g.rings) {
    ctx.globalAlpha = r.life / r.max; ctx.strokeStyle = r.color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
  }
  for (const p of g.parts) {
    ctx.globalAlpha = clamp(p.life / p.max * 1.4, 0, 1); ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  // tiros
  for (const b of g.pb) {
    ctx.fillStyle = 'rgba(110,230,255,0.35)'; ctx.fillRect(b.x - 3, b.y - 11, 6, 22);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(b.x - 1, b.y - 9, 2, 18);
  }
  for (const b of g.eb) {
    ctx.fillStyle = radial(ctx, b.x, b.y, 9, ['rgba(255,255,255,1)', 'rgba(255,110,170,0.8)', 'rgba(255,60,140,0)']);
    ctx.beginPath(); ctx.arc(b.x, b.y, 9, 0, TAU); ctx.fill();
  }
  // poeira estelar
  for (const d of g.dust) {
    const tw = 0.6 + 0.4 * Math.sin(time * 20 + d.x);
    ctx.fillStyle = `rgba(255,236,170,${tw})`;
    ctx.beginPath(); ctx.moveTo(d.x, d.y - 4); ctx.lineTo(d.x + 1.3, d.y); ctx.lineTo(d.x, d.y + 4); ctx.lineTo(d.x - 1.3, d.y); ctx.closePath(); ctx.fill();
    ctx.fillRect(d.x - 3, d.y - 0.6, 6, 1.2);
  }
  ctx.globalCompositeOperation = 'source-over';

  // power-ups
  for (const p of g.powers) {
    const col = POWERS[p.type].color, pulse = 1 + Math.sin(p.t * 6) * 0.08;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = radial(ctx, p.x, p.y, 22 * pulse, [col + '66', col + '22', col + '00']);
    ctx.beginPath(); ctx.arc(p.x, p.y, 22 * pulse, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, TAU); ctx.stroke();
    drawPowerIcon(p.type, p.x, p.y, 13);
  }

  drawPlayer();

  for (const t of g.texts) text(t.text, t.x, t.y, t.size, t.color, { alpha: clamp(t.t / t.max * 2, 0, 1), glow: 8 });

  if (player.slow > 0) {
    ctx.fillStyle = radial(ctx, W / 2, H / 2, H * 0.75, ['rgba(255,184,107,0)', 'rgba(255,184,107,0)', 'rgba(255,160,80,0.14)']);
    ctx.fillRect(0, 0, W, H);
  }
  if (g.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${g.flash * 0.5})`; ctx.fillRect(0, 0, W, H); }

  drawHUD();

  if (g.banner > 0) {
    const a = clamp(Math.min(g.banner, g.bannerMax - g.banner) * 2.5, 0, 1);
    text(g.bannerText, W / 2, H / 2 + 40, 46, '#ffffff', { alpha: a, glow: 22, weight: 800 });
    text(g.bannerSub, W / 2, H / 2 + 82, 16, '#b9c6ff', { alpha: a * 0.85, weight: 500 });
  }
}

function drawHUD() {
  const g = game;
  text('PONTOS', 20, 22, 11, '#8fa0e0', { align: 'left', weight: 600 });
  text(fmt(g.score), 20, 42, 22, '#ffffff', { align: 'left', weight: 800 });
  if (g.combo > 1) text('x' + (1 + Math.min(g.combo - 1, 10) * 0.1).toFixed(1), 20, 64, 14, '#ffd36e', { align: 'left' });
  text('RECORDE', W / 2, 22, 11, '#8fa0e0', { weight: 600 });
  text(fmt(Math.max(best, g.score)), W / 2, 42, 18, '#ffd36e', { weight: 800 });
  text('ONDA ' + g.wave, W - 58, 26, 15, '#c9d3ff', { align: 'right' });
  text('SETOR ' + g.sector, W - 58, 44, 11, '#8fa0e0', { align: 'right', weight: 600 });
  if (g.boss && g.boss.e >= 1) {
    const bw = 300, bx = (W - bw) / 2, by = 72, f = g.boss.hp / g.boss.maxHp;
    text('MÃE-COLMEIA', W / 2, by - 2, 11, '#e08bff', { weight: 700 });
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(bx, by + 8, bw, 6);
    ctx.fillStyle = f < 0.4 ? '#ff4f9a' : '#e08bff'; ctx.fillRect(bx, by + 8, bw * f, 6);
  }
  // pausa
  ctx.fillStyle = 'rgba(200,210,255,0.55)';
  ctx.fillRect(W - 36, 22, 5, 18); ctx.fillRect(W - 26, 22, 5, 18);
  // vidas
  for (let i = 0; i < g.lives - (player.alive ? 1 : 0) && i < 8; i++) drawSprite(SHIP, 26 + i * 26, H - 22, 0, 0.85, 0.42);
  // poeira
  const dx = W - 20;
  text(fmt(g.dustRun), dx, H - 22, 16, '#ffecaa', { align: 'right' });
  ctx.font = `700 16px ${FONT}`;
  const tw = ctx.measureText(fmt(g.dustRun)).width;
  ctx.fillStyle = '#ffecaa';
  const sx = dx - tw - 12, sy = H - 22;
  ctx.beginPath(); ctx.moveTo(sx, sy - 7); ctx.lineTo(sx + 2, sy - 2); ctx.lineTo(sx + 7, sy); ctx.lineTo(sx + 2, sy + 2); ctx.lineTo(sx, sy + 7); ctx.lineTo(sx - 2, sy + 2); ctx.lineTo(sx - 7, sy); ctx.lineTo(sx - 2, sy - 2); ctx.closePath(); ctx.fill();
  // power-ups ativos
  let px = 20;
  for (const [k, v, max] of [['twin', player.twin, 12], ['shield', player.shield, 20], ['slow', player.slow, 6]]) {
    if (v <= 0) continue;
    drawPowerIcon(k, px + 8, 88, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(px + 20, 86, 40, 4);
    ctx.fillStyle = POWERS[k].color; ctx.fillRect(px + 20, 86, 40 * (v / max), 4);
    px += 72;
  }
}

// ----------------------------------------------------------------- menu ---
const demo = [];
LAYOUT.slice(0, 4).forEach(([type, cols], row) => cols.forEach(col => demo.push({ type, row, col, x: 0, y: 0, rot: 0, anim: rand(0, 2), state: 'formation' })));

function drawMenu() {
  const fx = Math.sin(time * 0.55) * 48;
  for (const a of demo) { a.anim += 1 / 60; const s = slotPos(a, fx, time); a.x = s.x; a.y = s.y - 40; }
  drawAliens(demo, 0.35);

  const fy = Math.sin(time * 1.2) * 6;
  ctx.save();
  ctx.font = `800 70px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tg = ctx.createLinearGradient(0, 230, 0, 360);
  tg.addColorStop(0, '#ffffff'); tg.addColorStop(0.45, '#8fe9ff'); tg.addColorStop(1, '#c58cff');
  ctx.shadowColor = '#6fb8ff'; ctx.shadowBlur = 30; ctx.fillStyle = tg;
  ctx.fillText('STARLIT', W / 2, 265 + fy);
  ctx.fillText('SWARM', W / 2, 335 + fy);
  ctx.restore();
  text('um clássico do espaço, reimaginado', W / 2, 385 + fy, 15, '#b9c6ff', { weight: 500 });

  const rows = [['monarch'], ['warden'], ['stinger'], ['drone']];
  rows.forEach(([k], i) => {
    const y = 440 + i * 44, T = TYPES[k];
    drawSprite(T.spr[Math.floor(time * 2.2) % 2], 215, y, 0, 1, 0.8);
    text(`${T.pts}`, 262, y, 18, T.color, { align: 'left', weight: 800 });
    text(k === 'monarch' ? 'em ataque até 800' : `em ataque ${T.dive}`, 305, y, 14, '#8fa0e0', { align: 'left', weight: 500 });
  });

  const pulse = 0.55 + 0.45 * Math.sin(time * 3);
  text('TOQUE OU APERTE ESPAÇO', W / 2, 640, 20, '#ffffff', { alpha: pulse, glow: 12 });
  text(`Recorde  ${fmt(best)}     ✦ Poeira estelar  ${fmt(totalDust)}`, W / 2, 690, 14, '#ffd36e', { weight: 600 });
  text('← →  mover   ·   ESPAÇO  atirar   ·   P  pausar   ·   M  som', W / 2, 740, 12, '#7d8bc4', { weight: 500 });
  text('no celular: arraste o dedo para mover — o tiro é automático', W / 2, 760, 12, '#7d8bc4', { weight: 500 });
  text(Sound.muted ? 'som: desligado' : 'som: ligado', W / 2, 782, 11, '#5d6aa0', { weight: 500 });
}

function drawOverlay(title, lines) {
  ctx.fillStyle = 'rgba(6,5,21,0.62)'; ctx.fillRect(0, 0, W, H);
  text(title, W / 2, H / 2 - 90, 48, '#ffffff', { glow: 24, weight: 800 });
  lines.forEach(([s, size, color, gap], i) => text(s, W / 2, H / 2 - 30 + i * (gap || 38), size, color, { weight: 600 }));
}

function render() {
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  const sh = game && state !== 'menu' ? game.shake : 0;
  if (sh > 0.3) ctx.translate(rand(-sh, sh), rand(-sh, sh));
  drawBackground();
  if (state === 'menu') drawMenu();
  else {
    drawGame();
    if (state === 'paused') drawOverlay('PAUSADO', [['toque ou aperte P para continuar', 18, '#c9d3ff']]);
    if (state === 'over') {
      const ready = time - overAt > 1;
      drawOverlay('FIM DE JOGO', [
        [`${fmt(game.score)} pontos`, 28, '#ffffff'],
        [newRecord ? '★ NOVO RECORDE! ★' : `recorde: ${fmt(best)}`, 18, newRecord ? '#ffd36e' : '#8fa0e0'],
        [`✦ +${fmt(game.dustRun)} poeira estelar  (total ${fmt(totalDust)})`, 16, '#ffecaa'],
        [`chegou até a onda ${game.wave}`, 15, '#8fa0e0'],
        [ready ? 'toque ou aperte ESPAÇO para jogar de novo' : '', 18, '#ffffff', 46],
      ]);
    }
  }
}

// ---------------------------------------------------------------- input ---
function onPrimary() {
  if (state === 'menu') newGame();
  else if (state === 'over' && time - overAt > 1) newGame();
  else if (state === 'paused') state = 'playing';
}
function togglePause() {
  if (state === 'playing') { state = 'paused'; pointer.down = false; }
  else if (state === 'paused') state = 'playing';
}
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'fire', KeyZ: 'fire', ArrowUp: 'fire', KeyW: 'fire' };
const typing = e => e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
addEventListener('keydown', e => {
  if (typing(e)) return;
  Sound.init();
  const k = KEYMAP[e.code];
  if (k) { keys[k] = true; e.preventDefault(); }
  if (k === 'fire' && !e.repeat) onPrimary();
  if (e.code === 'Enter') onPrimary();
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (e.code === 'KeyM') Sound.toggle();
});
addEventListener('keyup', e => { if (typing(e)) return; const k = KEYMAP[e.code]; if (k) keys[k] = false; });
addEventListener('blur', () => { keys.left = keys.right = keys.fire = false; if (state === 'playing') togglePause(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (state === 'playing') togglePause(); if (Sound.ctx) Sound.ctx.suspend(); }
  else if (Sound.ctx) Sound.ctx.resume();
});

function toGame(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
canvas.addEventListener('pointerdown', e => {
  Sound.init();
  e.preventDefault();
  const p = toGame(e);
  if (state === 'playing') {
    if (p.x > W - 60 && p.y < 60) { togglePause(); return; }
    pointer.down = true; pointer.id = e.pointerId; pointer.lastX = p.x; pointer.target = player.x;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
  } else if (state === 'paused') togglePause();
  else onPrimary();
});
canvas.addEventListener('pointermove', e => {
  if (!pointer.down || e.pointerId !== pointer.id) return;
  const p = toGame(e);
  pointer.target = clamp((pointer.target ?? player.x) + (p.x - pointer.lastX) * 1.2, 24, W - 24);
  pointer.lastX = p.x;
});
const up = e => { if (e.pointerId === pointer.id) pointer.down = false; };
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', up);

// ----------------------------------------------------------------- loop ---
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - last) / 1000, 0, 1 / 30);
  last = now; time += dt;
  updateWorld(dt);
  if (game && (state === 'playing' || state === 'over')) updateGame(dt);
  render();
}
requestAnimationFrame(frame);

// gancho para testes automatizados
window.__starlit = { get state() { return state; }, get game() { return game; }, player, keys,
  pause() { keys.left = keys.right = keys.fire = false; pointer.down = false; if (state === 'playing') togglePause(); } };
})();
