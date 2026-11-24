// Rádio Fliperama: músicas originais compostas na hora pelo navegador (Web Audio), sem arquivos de áudio.
// Cada estação tem seu estilo; cada música nasce de uma "semente" e nunca se repete igual.
// Como o portal abre os jogos dentro da mesma página, a rádio continua tocando enquanto a pessoa joga.
(function () {
  'use strict';
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem('fliperama.radio.' + k)); return v ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('fliperama.radio.' + k, JSON.stringify(v)); } catch (e) {} }
  };

  // ---------------- teoria musical ----------------
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    mixo: [0, 2, 4, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11]
  };
  const PROGS = {
    major: [[0, 4, 5, 3], [0, 5, 3, 4], [5, 3, 0, 4], [0, 3, 4, 3], [3, 4, 2, 5], [0, 2, 3, 4]],
    minor: [[0, 5, 2, 6], [0, 3, 4, 0], [0, 6, 5, 6], [0, 2, 5, 4], [5, 6, 0, 0], [0, 3, 6, 2]]
  };
  const isMinor = s => s === 'minor' || s === 'dorian';
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const pick = (r, a) => a[Math.floor(r() * a.length)];

  const STATIONS = [
    { id: 'fliper', nome: 'Fliper FM', desc: 'Chiptune de fliperama', cor: '#ffe14d', bpm: [132, 150], scales: ['major', 'mixo', 'minor'], swing: 0,
      lead: { type: 'square', vol: .075, r: .05, oct: 5 }, bass: { type: 'triangle', vol: .2, style: 'chip', oct: 3 },
      chords: { style: 'arp', type: 'square', vol: .028, oct: 4 }, drums: 'chip', density: .5, delay: .18 },
    { id: 'neon', nome: 'Neon Drive', desc: 'Synthwave para acelerar', cor: '#ff3e9a', bpm: [96, 112], scales: ['minor', 'dorian'], swing: 0,
      lead: { type: 'sawtooth', vol: .05, r: .18, oct: 5, cut: 2400, a: .02 }, bass: { type: 'sawtooth', vol: .1, style: 'octaves8', oct: 2, cut: 700 },
      chords: { style: 'pad', vol: .03, oct: 4, cut: 1500 }, drums: 'synthwave', density: .32, delay: .34 },
    { id: 'lofi', nome: 'Lo-fi Lan House', desc: 'Batidas tranquilas para pensar', cor: '#2ee6d6', bpm: [72, 86], scales: ['dorian', 'major', 'minor'], swing: .2,
      lead: { type: 'triangle', vol: .07, r: .3, oct: 5 }, bass: { type: 'sine', vol: .26, style: 'lofi', oct: 2 },
      chords: { style: 'keys', type: 'triangle', vol: .045, oct: 4, sev: true }, drums: 'lofi', density: .22, delay: .15, filter: 1800, crackle: true },
    { id: 'orbita', nome: 'Órbita Zen', desc: 'Ambiente espacial, sem bateria', cor: '#9b8cff', bpm: [60, 70], scales: ['major', 'lydian'], swing: 0,
      lead: { type: 'sine', vol: .06, r: 1.4, oct: 6, bell: true }, bass: { type: 'sine', vol: .14, style: 'drone', oct: 2 },
      chords: { style: 'ambient', vol: .045, oct: 4, cut: 1200, sev: true }, drums: null, density: .12, delay: .45, chordBars: 2 }
  ];
  const DRUMS = {
    chip:      { k: ['x...x...x...x...', 'x...x...x.x.x...'], s: ['....x.......x...', '....x.......x..x'], h: ['x.x.x.x.x.x.x.x.'] },
    synthwave: { k: ['x...x...x...x...'], s: ['....x.......x...'], h: ['..x...x...x...x.', 'x.xxx.xxx.xxx.xx'] },
    lofi:      { k: ['x......x..x.....', 'x.........x..x..'], s: ['....x.......x...'], h: ['x.x.x.x.x.x.x.x.', 'x.x.x.xxx.x.x.x.'] }
  };
  const N1 = ['Lua', 'Ficha', 'Onda', 'Noite', 'Rua', 'Fita', 'Moeda', 'Avenida', 'Garagem', 'Estrela', 'Chuva', 'Tela', 'Fase', 'Trilha', 'Nuvem', 'Turbo', 'Cometa', 'Pixel', 'Laser', 'Controle'];
  const N2 = ['Neon', 'Prata', 'Pixel', 'Ouro', 'Vapor', 'Cristal', 'Chiclete', 'Plasma', 'Madrugada', 'Fliperama', 'Verão', 'Aluguel', 'Domingo', 'Asfalto', 'Algodão', 'Bônus', 'Recorde', 'Saturno', 'Arcade', 'Lan House'];

  function makeSong(st, seed) {
    const r = rng(seed);
    const scale = pick(r, st.scales);
    const prog = pick(r, PROGS[isMinor(scale) ? 'minor' : 'major']);
    const progB = pick(r, PROGS[isMinor(scale) ? 'minor' : 'major']);
    const motif = (dens) => {
      const bars = [];
      let deg = Math.floor(r() * 5) + 2;
      for (let b = 0; b < 2; b++) {
        const notes = [];
        for (let s = 0; s < 16; s++) {
          const w = s % 4 === 0 ? 1.7 : s % 2 === 0 ? 1 : .55;
          if (r() < dens * w) { deg = Math.max(0, Math.min(11, deg + pick(r, [-2, -1, -1, 0, 1, 1, 2, 3, -3]))); notes.push({ s, deg }); }
        }
        for (let i = 0; i < notes.length; i++) notes[i].len = Math.min(4, (notes[i + 1] ? notes[i + 1].s : 16) - notes[i].s);
        bars.push(notes);
      }
      return bars;
    };
    const cb = st.chordBars || 1;
    const sec = (type, bars, p, mel) => ({ type, bars: bars * cb, prog: p, mel });
    const A = motif(st.density), B = motif(st.density * 1.15);
    return {
      seed, scale, root: Math.floor(r() * 12), bpm: Math.round(st.bpm[0] + r() * (st.bpm[1] - st.bpm[0])),
      titulo: pick(r, N1) + ' de ' + pick(r, N2),
      sections: [sec('intro', 4, prog, null), sec('a', 8, prog, A), sec('b', 8, progB, B), sec('a', 8, prog, A), sec('b', 8, progB, B), sec('outro', 4, prog, null)],
      hatVar: Math.floor(r() * 2), kickVar: Math.floor(r() * 2)
    };
  }

  // ---------------- áudio ----------------
  let A = null, bus, master, analyser, delayIn, lofi, noise, timer = null;
  let playing = false, stIdx = Math.max(0, STATIONS.findIndex(s => s.id === store.get('estacao', 'fliper')));
  let vol = store.get('volume', .6);
  let song = null, secI = 0, bar = 0, step = 0, nextT = 0;

  function initAudio() {
    if (A) return;
    A = new (window.AudioContext || window.webkitAudioContext)();
    master = A.createGain(); master.gain.value = vol * vol;
    analyser = A.createAnalyser(); analyser.fftSize = 64;
    const comp = A.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
    lofi = A.createBiquadFilter(); lofi.type = 'lowpass'; lofi.frequency.value = 16000;
    bus = A.createGain();
    bus.connect(lofi); lofi.connect(comp); comp.connect(master); master.connect(analyser); analyser.connect(A.destination);
    // eco (delay) para o solo
    delayIn = A.createGain(); delayIn.gain.value = 0;
    const dl = A.createDelay(1.5), fb = A.createGain(), dlf = A.createBiquadFilter();
    fb.gain.value = .38; dlf.type = 'lowpass'; dlf.frequency.value = 2800;
    delayIn.connect(dl); dl.connect(dlf); dlf.connect(fb); fb.connect(dl); dlf.connect(bus);
    delayIn.dl = dl;
    noise = A.createBuffer(1, A.sampleRate, A.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function tone(t, f, dur, o) {
    const g = A.createGain(), v = o.vol, a = o.a || .005, rel = o.r || .08;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.setTargetAtTime(v * (o.sus ?? .7), t + a, Math.max(.02, dur * .3));
    g.gain.setTargetAtTime(0, t + Math.max(a, dur), rel / 3);
    let out = g;
    if (o.cut) { const fl = A.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.cut; fl.Q.value = o.q || .7; g.connect(fl); out = fl; }
    out.connect(bus);
    if (o.send) { const s = A.createGain(); s.gain.value = o.send; out.connect(s); s.connect(delayIn); }
    const oscs = o.detune ? [-o.detune, o.detune] : [0];
    for (const dt of oscs) {
      const osc = A.createOscillator(); osc.type = o.type || 'square';
      osc.frequency.setValueAtTime(f, t); osc.detune.value = dt;
      osc.connect(g); osc.start(t); osc.stop(t + dur + rel * 2 + .05);
    }
  }
  function noiseHit(t, dur, vol, type, freq, q) {
    const src = A.createBufferSource(); src.buffer = noise;
    const fl = A.createBiquadFilter(); fl.type = type; fl.frequency.value = freq; if (q) fl.Q.value = q;
    const g = A.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(bus);
    src.start(t, Math.random() * .5); src.stop(t + dur + .02);
  }
  function kick(t, v, soft) {
    const o = A.createOscillator(), g = A.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(soft ? 110 : 150, t); o.frequency.exponentialRampToValueAtTime(42, t + .12);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + (soft ? .25 : .32));
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + .4);
  }
  function snare(t, v, kind) {
    if (kind === 'lofi') { noiseHit(t, .14, v * .7, 'bandpass', 1800, .8); tone(t, 180, .05, { type: 'triangle', vol: v * .5, r: .05 }); return; }
    noiseHit(t, kind === 'synthwave' ? .28 : .12, v, 'highpass', kind === 'chip' ? 2500 : 1300);
    tone(t, kind === 'chip' ? 220 : 185, .05, { type: 'triangle', vol: v * .6, r: .06 });
  }
  function hat(t, v) { noiseHit(t, .035, v, 'highpass', 7500); }

  function degMidi(deg, oct) {
    const sc = SCALES[song.scale], o = Math.floor(deg / 7), i = ((deg % 7) + 7) % 7;
    return 12 * (oct + 1) + song.root + sc[i] + 12 * o;
  }

  function playStep(t) {
    const st = STATIONS[stIdx], sec = song.sections[secI], sd = 60 / song.bpm / 4;
    const cb = st.chordBars || 1;
    const chordDeg = sec.prog[Math.floor(bar / cb) % sec.prog.length];
    const tones = [chordDeg, chordDeg + 2, chordDeg + 4]; if (st.chords.sev) tones.push(chordDeg + 6);
    const lastBar = bar === sec.bars - 1;
    const fadeOut = sec.type === 'outro' ? 1 - bar / sec.bars * .7 : 1;

    // acordes
    const ch = st.chords;
    if (ch.style === 'arp') {
      const seq = [0, 1, 2, 1];
      tone(t, mtof(degMidi(tones[seq[step % 4]] + (step >= 8 ? 7 : 0), ch.oct)), sd * .9, { type: ch.type, vol: ch.vol * fadeOut, r: .03, sus: .5 });
    } else if (ch.style === 'pad' && step === 0) {
      for (const d of tones) tone(t, mtof(degMidi(d, ch.oct)), sd * 15, { type: 'sawtooth', vol: ch.vol * fadeOut, a: .25, r: .4, sus: .8, cut: ch.cut, detune: 9 });
    } else if (ch.style === 'keys' && (step === 0 || step === 7)) {
      tones.forEach((d, i) => tone(t + i * .012, mtof(degMidi(d, ch.oct)), sd * (step === 0 ? 6 : 4), { type: ch.type, vol: ch.vol * fadeOut, a: .01, r: .35, sus: .45 }));
    } else if (ch.style === 'ambient' && step === 0 && bar % cb === 0) {
      for (const d of tones) tone(t, mtof(degMidi(d, ch.oct)), sd * 16 * cb, { type: 'sawtooth', vol: ch.vol * fadeOut, a: 1.6, r: 2, sus: .9, cut: ch.cut, detune: 7 });
    }

    // baixo
    const b = st.bass, root = mtof(degMidi(chordDeg, b.oct)), fifth = mtof(degMidi(chordDeg + 4, b.oct));
    if (b.style === 'chip') {
      if (step % 4 === 0) tone(t, root, sd * 1.8, { type: b.type, vol: b.vol, r: .04 });
      else if (step === 6 || step === 14) tone(t, fifth, sd * 1.5, { type: b.type, vol: b.vol * .8, r: .04 });
    } else if (b.style === 'octaves8') {
      if (step % 2 === 0) tone(t, root * (step % 4 === 2 ? 2 : 1), sd * 1.5, { type: b.type, vol: b.vol, r: .05, cut: b.cut, q: 4 });
    } else if (b.style === 'lofi') {
      if (step === 0) tone(t, root, sd * 6, { type: b.type, vol: b.vol, a: .01, r: .2 });
      else if (step === 10) tone(t, r2() < .5 ? root : fifth, sd * 4, { type: b.type, vol: b.vol * .85, a: .01, r: .2 });
    } else if (b.style === 'drone' && step === 0 && bar % cb === 0) {
      tone(t, root, sd * 16 * cb, { type: b.type, vol: b.vol * fadeOut, a: 1, r: 1.5, sus: .9 });
    }

    // solo
    if (sec.mel) {
      const l = st.lead, notes = sec.mel[bar % 2];
      const varied = bar >= sec.bars - 2 && sec.type === 'b';
      for (const n of notes) {
        if (n.s !== step) continue;
        let deg = n.deg + (varied ? 2 : 0);
        if (step % 4 === 0) { // tempo forte: puxa para uma nota do acorde
          let best = deg, bd = 99;
          for (const c of tones) for (const k of [-7, 0, 7, 14]) { const dd = Math.abs(c + k - deg); if (dd < bd) { bd = dd; best = c + k; } }
          deg = best;
        }
        const f = mtof(degMidi(deg, l.oct));
        tone(t, f, sd * n.len * .9, { type: l.type, vol: l.vol, a: l.a, r: l.r, cut: l.cut, sus: l.bell ? .2 : .75, send: st.delay });
        if (l.bell) tone(t, f * 2, sd * n.len * .5, { type: 'sine', vol: l.vol * .3, r: l.r, sus: .1, send: st.delay });
      }
    }

    // bateria
    const dk = st.drums && DRUMS[st.drums];
    if (dk && sec.type !== 'intro' || (dk && sec.type === 'intro' && bar >= sec.bars - 2)) {
      const kp = dk.k[song.kickVar % dk.k.length], sp = dk.s[(lastBar ? 1 : 0) % dk.s.length], hp = dk.h[song.hatVar % dk.h.length];
      const dv = st.drums === 'lofi' ? .5 : .8;
      if (kp[step] === 'x') kick(t, dv * fadeOut, st.drums === 'lofi');
      if (sec.type !== 'intro') {
        if (sp[step] === 'x') snare(t, dv * .45 * fadeOut, st.drums);
        if (lastBar && step >= 12 && sec.type !== 'outro') snare(t, dv * .3, st.drums);
        if (hp[step] === 'x') hat(t, (step % 4 === 0 ? .12 : .07) * dv * fadeOut);
      }
    }
    if (st.crackle && r2() < .45) noiseHit(t + r2() * sd, .006, .05, 'bandpass', 3000 + r2() * 3000, 1);
  }
  const r2 = Math.random;

  function newSong() {
    const st = STATIONS[stIdx];
    song = makeSong(st, (Math.random() * 1e9) | 0);
    secI = 0; bar = 0; step = 0;
    lofi.frequency.setTargetAtTime(st.filter || 16000, A.currentTime, .3);
    delayIn.gain.setTargetAtTime(1, A.currentTime, .1);
    delayIn.dl.delayTime.setValueAtTime(60 / song.bpm * .75, A.currentTime);
    ui();
  }

  function tick() {
    const look = document.hidden ? 1.6 : .2;
    while (nextT < A.currentTime + look) {
      const st = STATIONS[stIdx], sd = 60 / song.bpm / 4;
      const sw = step % 2 ? st.swing * sd : 0;
      playStep(nextT + sw);
      nextT += sd;
      if (++step >= 16) {
        step = 0;
        if (++bar >= song.sections[secI].bars) {
          bar = 0;
          if (++secI >= song.sections.length) { newSong(); nextT += sd * 4; }
        }
      }
    }
  }

  function play() {
    initAudio();
    if (A.state === 'suspended') A.resume();
    if (playing) return;
    playing = true;
    master.gain.cancelScheduledValues(A.currentTime);
    master.gain.setValueAtTime(0, A.currentTime); master.gain.linearRampToValueAtTime(vol * vol, A.currentTime + .4);
    if (!song) newSong();
    nextT = A.currentTime + .08;
    timer = setInterval(tick, 50); tick();
    store.set('tocando', true);
    ui();
  }
  function stop(keep) {
    if (!playing) return;
    playing = false; clearInterval(timer);
    const t = A.currentTime;
    master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(0, t + .25);
    if (!keep) store.set('tocando', false);
    ui();
  }
  function setStation(i) {
    stIdx = (i + STATIONS.length) % STATIONS.length;
    store.set('estacao', STATIONS[stIdx].id);
    if (!A) { ui(); return play(); }
    const was = playing;
    if (was) stop(true);
    setTimeout(() => { newSong(); play(); }, was ? 280 : 0);
  }
  function nextSong() { if (!A) return play(); const was = playing; if (was) stop(true); setTimeout(() => { newSong(); play(); }, was ? 280 : 0); }

  // ---------------- interface ----------------
  const btn = document.createElement('button');
  btn.className = 'radio-btn'; btn.id = 'radio-btn'; btn.type = 'button'; btn.title = 'Rádio Fliperama';
  btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'radio-panel');
  btn.innerHTML = '<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span><span class="rb-txt">Rádio</span>';
  const anchor = document.getElementById('account');
  if (anchor) anchor.before(btn); else document.querySelector('.topbar')?.appendChild(btn);

  const panel = document.createElement('div');
  panel.className = 'radio-panel'; panel.id = 'radio-panel'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Rádio Fliperama');
  panel.innerHTML = `
    <div class="rp-head"><b>📻 Rádio Fliperama</b><span class="rp-live" id="rp-live">desligada</span><button class="rp-x" type="button" aria-label="Fechar a rádio">×</button></div>
    <div class="rp-now"><canvas id="rp-vis" width="120" height="56" aria-hidden="true"></canvas>
      <div class="rp-info"><span class="rp-st" id="rp-st"></span><span class="rp-song" id="rp-song">Aperte o play</span></div></div>
    <div class="rp-ctrl">
      <button type="button" id="rp-prev" aria-label="Estação anterior" title="Estação anterior">⏮</button>
      <button type="button" class="rp-play" id="rp-play" aria-label="Tocar">▶</button>
      <button type="button" id="rp-next" aria-label="Próxima música" title="Próxima música">⏭</button>
    </div>
    <div class="rp-list" id="rp-list"></div>
    <label class="rp-vol"><span aria-hidden="true">🔈</span><input type="range" id="rp-vol" min="0" max="100" aria-label="Volume da rádio"><span aria-hidden="true">🔊</span></label>
    <p class="rp-foot">Músicas originais compostas na hora pelo seu navegador. Elas continuam tocando enquanto você joga.</p>`;
  document.body.appendChild(panel);
  const q = id => document.getElementById(id);
  const list = q('rp-list');
  STATIONS.forEach((s, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'rp-station'; b.style.setProperty('--c', s.cor);
    b.innerHTML = `<i aria-hidden="true"></i><span><b>${s.nome}</b><small>${s.desc}</small></span>`;
    b.onclick = () => setStation(i);
    list.appendChild(b);
  });
  q('rp-vol').value = Math.round(vol * 100);
  q('rp-vol').oninput = e => { vol = e.target.value / 100; store.set('volume', vol); if (A && playing) master.gain.setTargetAtTime(vol * vol, A.currentTime, .05); };
  q('rp-play').onclick = () => playing ? stop() : play();
  q('rp-next').onclick = nextSong;
  q('rp-prev').onclick = () => setStation(stIdx - 1);
  panel.querySelector('.rp-x').onclick = () => toggle(false);

  function place() {
    const r = btn.getBoundingClientRect();
    panel.style.top = Math.round(r.bottom + 10) + 'px';
  }
  function toggle(open) {
    open = open ?? panel.hidden;
    panel.hidden = !open; btn.setAttribute('aria-expanded', String(open));
    if (open) { place(); draw(); }
  }
  btn.onclick = () => toggle();
  document.addEventListener('pointerdown', e => { if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) toggle(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) toggle(false); });
  addEventListener('resize', () => { if (!panel.hidden) place(); });

  function ui() {
    const st = STATIONS[stIdx];
    btn.classList.toggle('on', playing);
    btn.style.setProperty('--c', st.cor);
    q('rp-play').textContent = playing ? '⏸' : '▶';
    q('rp-play').setAttribute('aria-label', playing ? 'Pausar' : 'Tocar');
    q('rp-st').textContent = st.nome;
    q('rp-song').textContent = song && playing ? `♪ ${song.titulo} · ${song.bpm} bpm` : (playing ? '' : 'Aperte o play');
    q('rp-live').textContent = playing ? 'no ar' : 'desligada';
    q('rp-live').classList.toggle('on', playing);
    panel.style.setProperty('--c', st.cor);
    [...list.children].forEach((b, i) => b.classList.toggle('sel', i === stIdx));
  }

  // visualizador
  const vis = q('rp-vis'), vctx = vis.getContext('2d');
  let buf = null;
  function draw() {
    if (panel.hidden) return;
    requestAnimationFrame(draw);
    const w = vis.width, h = vis.height, n = 12, bw = w / n;
    vctx.clearRect(0, 0, w, h);
    vctx.fillStyle = STATIONS[stIdx].cor;
    if (analyser && playing) { buf = buf || new Uint8Array(analyser.frequencyBinCount); analyser.getByteFrequencyData(buf); }
    for (let i = 0; i < n; i++) {
      const v = playing && buf ? buf[i + 1] / 255 : .06;
      const bh = Math.max(3, v * h);
      vctx.fillRect(i * bw + 1, h - bh, bw - 3, bh);
    }
  }

  // se a rádio estava ligada na última visita, volta a tocar no primeiro clique/toque na página
  if (store.get('tocando', false)) {
    const resumeOnce = e => {
      if (btn.contains(e.target) || panel.contains(e.target)) return;
      removeEventListener('pointerdown', resumeOnce, true);
      if (!playing) play();
    };
    addEventListener('pointerdown', resumeOnce, true);
  }
  ui();
  window.Radio = { play, stop, setStation, nextSong, get playing() { return playing; } };
})();
