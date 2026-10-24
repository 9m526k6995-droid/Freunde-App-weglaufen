'use strict';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const KEY = 'pinged.v1', BUYKEY = 'pinged.purchase';
const COLORS = ['#32d74b', '#64d2ff', '#bf5af2', '#ff375f', '#ff9f0a', '#66d4cf'];
const BOT_NAMES = ['Dominick', 'Noah', 'Cyrus', 'Lina', 'Mara', 'Jonas', 'Elif', 'Ben', 'Aylin', 'Theo', 'Sofia'];
const HUNT = '#ff453a', TAPE = '#ffd60a', RUN = '#32d74b';
const CFG = window.PINGED_CONFIG || {};
const DEFAULT_ORIGIN = { lat: 52.5219, lng: 13.4132 }; // Alexanderplatz, Berlin

/* ---------- storage ---------- */
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function fresh() {
  return {
    created: null, profile: null, dob: null, minor: false,
    parent: { mail: '', confirmed: false, confirmedAt: null },
    consents: { agb: false, ds: false, safe: false, loc: false, cam: false, mic: false, push: false, stats: false, at: null },
    pass: null, emergency: '',
    stats: { rounds: 0, catches: 0, escapes: 0, meters: 0 }
  };
}
let S = load() || fresh();
function purchaseStored() { try { return localStorage.getItem(BUYKEY); } catch (e) { return null; } }
function storePurchase(v) { try { localStorage.setItem(BUYKEY, v); } catch (e) {} }

/* ---------- helpers ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const fmt = sec => { sec = Math.max(0, Math.ceil(sec)); return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toLocaleDateString('de-DE');
function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2600); }
function overlay(html, wire) { $('#overlayCard').innerHTML = html; $('#overlay').hidden = false; wire && wire($('#overlayCard')); }
function closeOverlay() { $('#overlay').hidden = true; }
function ageFrom(dob) { const d = new Date(dob), n = new Date(); let a = n.getFullYear() - d.getFullYear(); const m = n.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--; return a; }
function nightNow() { const h = new Date().getHours(); return h >= 22 || h < 6; }

/* ---------- navigation ---------- */
const stack = [];
const onShow = {};
function show(id, push = true) {
  const cur = document.querySelector('.screen:not([hidden])');
  if (cur && cur.id !== id) { if (push) stack.push(cur.id); cur.hidden = true; }
  $('#' + id).hidden = false;
  window.scrollTo(0, 0);
  onShow[id] && onShow[id]();
}
function back() { const id = stack.pop(); if (id) show(id, false); }
function goHome() { stack.length = 0; show('scr-home', false); }
document.addEventListener('click', e => {
  if (e.target.closest('[data-back]')) { back(); return; }
  const d = e.target.closest('[data-doc]');
  if (d) { e.preventDefault(); closeOverlay(); openDoc(d.dataset.doc); }
});
$('#overlay').addEventListener('click', e => { if (e.target.id === 'overlay' && !G.paused) closeOverlay(); });

/* ---------- audio ---------- */
let AC = null;
function audio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
function tone(f, d, type = 'sine', vol = .18, when = 0) {
  const ac = AC; if (!ac) return;
  const t = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + .02);
}
function kick(when = 0, vol = .5) {
  const ac = AC; if (!ac) return;
  const t = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain();
  o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + .18);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + .25);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + .3);
}
function noise(when = 0, d = .05, vol = .12, hp = 6000) {
  const ac = AC; if (!ac) return;
  const t = ac.currentTime + when, len = Math.floor(ac.sampleRate * d), buf = ac.createBuffer(1, len, ac.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
  src.buffer = buf; src.connect(f).connect(g).connect(ac.destination); src.start(t);
}
const sfx = {
  ping() { tone(880, .12, 'square', .08); tone(1320, .25, 'sine', .14, .1); },
  pinged() { tone(220, .3, 'sawtooth', .1); tone(180, .4, 'sawtooth', .1, .15); },
  catch() { noise(0, .35, .25, 800); tone(110, .5, 'triangle', .3); },
  beat(v = .45) { kick(0, v); kick(.16, v * .6); },
  loot() { tone(660, .08, 'square', .07); tone(990, .08, 'square', .07, .08); tone(1320, .2, 'square', .07, .16); }
};
function say(text) {
  if (!G.voice || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text); u.lang = 'de-DE'; u.rate = 1.08; u.pitch = .9;
    const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith('de')); if (v) u.voice = v;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) {}
}

/* ---------- world (eingebaute Karte, wenn keine echte Karte geladen ist) ---------- */
const R0 = 320;
function makeWorld(seed = 11) {
  const r = rng(seed), N = 7, step = 84, rot = -.14, cs = Math.cos(rot), sn = Math.sin(rot);
  // leicht gedrehtes, verzogenes Straßenraster wie in einer echten Altstadt
  const node = {};
  for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) {
    const jx = (i && j) ? (r() - .5) * 18 : 0, jy = (i && j) ? (r() - .5) * 18 : 0;
    const x = i * step + jx, y = j * step + jy;
    node[i + ',' + j] = { x: x * cs - y * sn, y: x * sn + y * cs };
  }
  const nd = (i, j) => node[i + ',' + j];
  const roads = [];
  for (let i = -N; i <= N; i++) {
    const cls = i === 0 ? 2 : i % 3 === 0 ? 1 : 0;
    roads.push({ cls, pts: Array.from({ length: 2 * N + 1 }, (_, k) => nd(i, k - N)) });
    roads.push({ cls, pts: Array.from({ length: 2 * N + 1 }, (_, k) => nd(k - N, i)) });
  }
  // Prachtstraße quer durch die Stadt
  roads.push({ cls: 3, pts: [{ x: -620, y: 430 }, { x: 640, y: -330 }] });
  const plaza = new Set(['-1,-1', '0,-1', '-1,0', '0,0']);
  const blockedCells = { '-3,-2': 'Baustelle', '2,-3': 'Bahnhofsgelände', '1,2': 'Schulhof' };
  const blocks = [], blocked = [], trees = [];
  for (let i = -N; i < N; i++) for (let j = -N; j < N; j++) {
    const q = [nd(i, j), nd(i + 1, j), nd(i + 1, j + 1), nd(i, j + 1)];
    const c = { x: q.reduce((a, p) => a + p.x, 0) / 4, y: q.reduce((a, p) => a + p.y, 0) / 4 };
    const inset = (poly, d) => poly.map(p => { const dx = c.x - p.x, dy = c.y - p.y, l = Math.hypot(dx, dy); return { x: p.x + dx / l * d, y: p.y + dy / l * d }; });
    const key = i + ',' + j, poly = inset(q, 13);
    if (blockedCells[key]) { blocked.push({ poly, name: blockedCells[key], c }); continue; }
    const park = plaza.has(key) || r() < .09;
    const b = { poly, park, plaza: plaza.has(key), bld: [] };
    if (park && !b.plaza) for (let k = 0; k < 26; k++) { const u = r(), w = r(); const a = lerpP(lerpP(poly[0], poly[1], u), lerpP(poly[3], poly[2], u), w); trees.push({ x: a.x, y: a.y, r: 3 + r() * 4 }); }
    if (!park) {
      // Block in Häuser unterteilen
      const n = 2 + Math.floor(r() * 3), m = r() < .6 ? 2 : 1;
      for (let a = 0; a < n; a++) for (let bb = 0; bb < m; bb++) {
        if (m === 2 && n > 2 && a > 0 && a < n - 1 && r() < .5) continue; // Innenhof
        const u0 = a / n, u1 = (a + 1) / n, w0 = bb / m, w1 = (bb + 1) / m, g = .035;
        const P = (u, w) => lerpP(lerpP(poly[0], poly[1], u), lerpP(poly[3], poly[2], u), w);
        b.bld.push({ pts: [P(u0 + g, w0 + g), P(u1 - g, w0 + g), P(u1 - g, w1 - g), P(u0 + g, w1 - g)], h: .5 + r() * .9 });
      }
    }
    blocks.push(b);
  }
  // Fluss am Nordrand, Bahntrasse im Osten
  const river = Array.from({ length: 30 }, (_, k) => { const x = -700 + k * 50; return { x, y: -395 + Math.sin(x / 170) * 38 }; });
  const rail = Array.from({ length: 24 }, (_, k) => { const y = -700 + k * 62; return { x: 430 + Math.sin(y / 260) * 40, y }; });
  const labels = [
    { a: nd(0, -4), b: nd(0, -3), t: 'TARASTRASSE' },
    { a: nd(-5, 0), b: nd(-4, 0), t: 'REBECCA-ALLEE' },
    { a: { x: -300, y: 249 }, b: { x: -200, y: 189 }, t: 'BOULEVARD' },
    { a: nd(3, 3), b: nd(4, 3), t: 'AM MARKT' },
    { a: { x: -120, y: -405 }, b: { x: -20, y: -400 }, t: 'S P R E E', water: true }
  ];
  return { blocks, blocked, trees, roads, river, rail, labels };
}
function lerpP(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
const WORLD = makeWorld();
function inPoly(p, poly) { let k = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) k = !k; } return k; }
function segDist(p, a, b) { const dx = b.x - a.x, dy = b.y - a.y, t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); }
function inBlocked(p, m = 2) {
  if (G && G.useMap) return null;
  return WORLD.blocked.find(b => inPoly(p, b.poly) || b.poly.some((a, i) => segDist(p, a, b.poly[(i + 1) % b.poly.length]) < m));
}

const worldCache = new Map();
/* zeichnet die statische Karte in ctx; view = {cx, cy, s}. Wird pro Größe einmal gerendert und dann nur noch kopiert. */
function drawWorld(ctx, v, W, H, opts = {}) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const key = [W, H, v.cx, v.cy, v.s.toFixed(4), opts.labels !== false, opts.blockedLabels !== false].join('|');
  let cv = worldCache.get(key);
  if (!cv) {
    if (worldCache.size > 8) worldCache.clear();
    cv = document.createElement('canvas'); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderWorld(c, v, W, H, opts); worldCache.set(key, cv);
  }
  ctx.drawImage(cv, 0, 0, W, H);
}
function renderWorld(ctx, v, W, H, opts) {
  const s = v.s, T = p => [v.cx + p.x * s, v.cy + p.y * s];
  const path = (pts, close = true) => { ctx.beginPath(); pts.forEach((p, k) => { const [x, y] = T(p); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); if (close) ctx.closePath(); };
  const line = (pts, w, col, dash) => { path(pts, false); ctx.lineWidth = Math.max(.6, w * s); ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]); };
  ctx.fillStyle = '#0c0d10'; ctx.fillRect(0, 0, W, H);
  // Blöcke, Parks, Platz
  for (const b of WORLD.blocks) {
    path(b.poly); ctx.fillStyle = b.plaza ? '#15161a' : b.park ? '#0c1712' : '#101114'; ctx.fill();
    if (b.plaza) { // Pflaster-Muster und Brunnen
      ctx.save(); path(b.poly); ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,.025)'; ctx.lineWidth = 1;
      for (let g = -900; g < 900; g += 9) { const [x, y] = T({ x: g, y: -900 }), [x2, y2] = T({ x: g + 120, y: 900 }); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke(); }
      ctx.restore();
    }
  }
  { const [x, y] = T({ x: -32, y: -30 }); ctx.beginPath(); ctx.arc(x, y, 13 * s, 0, 7); ctx.fillStyle = '#0d1a24'; ctx.fill(); ctx.strokeStyle = 'rgba(100,180,255,.18)'; ctx.lineWidth = 1; ctx.stroke(); }
  for (const t of WORLD.trees) { const [x, y] = T(t); ctx.beginPath(); ctx.arc(x, y, t.r * s, 0, 7); ctx.fillStyle = '#10241a'; ctx.fill(); ctx.beginPath(); ctx.arc(x - t.r * s * .3, y - t.r * s * .3, t.r * s * .45, 0, 7); ctx.fillStyle = '#163222'; ctx.fill(); }
  // Fluss
  line(WORLD.river, 64, '#0f1c27'); line(WORLD.river, 54, '#0a1520');
  // Straßen: Rand, dann Belag
  const W_ = [8, 13, 17, 22], C_ = ['#1b1d22', '#23262c', '#292c33', '#2d2f35'];
  for (const r of WORLD.roads) line(r.pts, W_[r.cls] + 3, '#08090b');
  for (const r of WORLD.roads) line(r.pts, W_[r.cls], C_[r.cls]);
  for (const r of WORLD.roads) if (r.cls >= 2) line(r.pts, 1, 'rgba(255,255,255,.07)', [6 * s, 9 * s]);
  // Bahntrasse
  line(WORLD.rail, 16, '#121317'); line(WORLD.rail, 9, 'rgba(255,255,255,.06)', [1.2 * s, 3.5 * s]); line(WORLD.rail, 1.2, 'rgba(255,255,255,.12)');
  // Häuser mit Höhe: dunkle Fassade nach Süden versetzt, Dach darüber
  const off = Math.max(1.2, 6 * s);
  for (const b of WORLD.blocks) for (const h of b.bld) { path(h.pts.map(p => ({ x: p.x, y: p.y + h.h * off / s }))); ctx.fillStyle = '#060708'; ctx.fill(); }
  for (const b of WORLD.blocks) for (const h of b.bld) {
    path(h.pts); const l = 22 + Math.round(h.h * 7); ctx.fillStyle = `rgb(${l},${l + 1},${l + 5})`; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 1; ctx.stroke();
  }
  // Gesperrte Bereiche: rot getönt, dezente Streifen
  for (const b of WORLD.blocked) {
    ctx.save(); path(b.poly); ctx.fillStyle = 'rgba(255,69,58,.09)'; ctx.fill(); ctx.clip();
    ctx.strokeStyle = 'rgba(255,69,58,.16)'; ctx.lineWidth = 1;
    for (let g = -900; g < 900; g += 7) { const [x, y] = T({ x: g, y: -900 }), [x2, y2] = T({ x: g + 900, y: 0 }); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke(); }
    ctx.restore(); path(b.poly); ctx.strokeStyle = 'rgba(255,69,58,.55)'; ctx.lineWidth = 1.2; ctx.stroke();
    if (opts.blockedLabels !== false && s > .45) {
      const [x, y] = T(b.c); ctx.font = '600 10px "Geist", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ff8a80'; ctx.fillText(b.name, x, y); ctx.textBaseline = 'alphabetic';
    }
  }
  // Straßennamen
  if (opts.labels !== false && s > .5) {
    ctx.font = `600 ${Math.round(8.5 * Math.min(1.3, s))}px "Geist Mono", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const l of WORLD.labels) {
      const m = lerpP(l.a, l.b, .5), [x, y] = T(m); let ang = Math.atan2(l.b.y - l.a.y, l.b.x - l.a.x); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.lineWidth = 3; ctx.strokeStyle = '#0c0d10'; ctx.strokeText(l.t, 0, 0);
      ctx.fillStyle = l.water ? 'rgba(90,150,200,.45)' : 'rgba(236,235,230,.34)'; ctx.fillText(l.t, 0, 0); ctx.restore();
    }
    ctx.textBaseline = 'alphabetic';
  }
  // Vignette
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.45)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function drawZone(ctx, v, W, H, r) {
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(v.cx, v.cy, r * v.s, 0, Math.PI * 2, true);
  ctx.fillStyle = 'rgba(8,9,11,.62)'; ctx.fill('evenodd'); ctx.restore();
  ctx.save(); ctx.setLineDash([10, 7]); ctx.strokeStyle = TAPE; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(v.cx, v.cy, r * v.s, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}
function fitCanvas(c) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), r = c.getBoundingClientRect();
  const W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
  if (c.width !== W * dpr || c.height !== H * dpr) { c.width = W * dpr; c.height = H * dpr; }
  const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, W, H };
}

/* ---------- small animated maps (welcome / home / zone preview) ---------- */
function demoDots(n, seed) { const r = rng(seed); return Array.from({ length: n }, (_, i) => ({ x: (r() - .5) * 420, y: (r() - .5) * 420, c: i === 0 ? HUNT : COLORS[i % COLORS.length], ph: r() * 6 })); }
const heroDots = demoDots(6, 3), homeDots = demoDots(5, 9);
function drawMini(c, dots, t, zoom = 1.25) {
  const { ctx, W, H } = fitCanvas(c);
  const v = { cx: W / 2, cy: H / 2 + 10, s: (Math.min(W, H) / (2 * R0)) * zoom };
  drawWorld(ctx, v, W, H, { blockedLabels: false });
  drawZone(ctx, v, W, H, R0);
  LBL = [];
  dots.forEach((d, i) => {
    const x = v.cx + (d.x + Math.sin(t / 1600 + d.ph) * 30) * v.s, y = v.cy + (d.y + Math.cos(t / 1900 + d.ph) * 30) * v.s;
    const col = i === 0 ? HUNT : RUN;
    if (i > 0) for (let k = 0; k < 2; k++) { const pulse = ((t / 1000 + d.ph + k * .8) % 1.6) / 1.6; ctx.beginPath(); ctx.arc(x, y, 8 + pulse * 24, 0, 7); ctx.strokeStyle = `rgba(50,215,75,${.9 * (1 - pulse)})`; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fillStyle = col; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fillStyle = '#0b0c0f'; ctx.fill();
    label(ctx, i === 0 ? 'Du' : BOT_NAMES[i], x, y - 22);
  });
  LBL = null;
}
function drawZonePreview() {
  const c = $('#zoneCanvas'); const { ctx, W, H } = fitCanvas(c);
  const v = { cx: W / 2, cy: H / 2, s: Math.min(W, H) / (2 * R0 * 1.08) };
  drawWorld(ctx, v, W, H); drawZone(ctx, v, W, H, R0);
  ctx.beginPath(); ctx.arc(v.cx, v.cy, 9, 0, 7); ctx.fillStyle = TAPE; ctx.fill();
  ctx.fillStyle = '#ecebe6'; ctx.font = '700 11px "Geist Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('START', v.cx, v.cy - 16);
}
function miniLoop(t) {
  if (!$('#scr-welcome').hidden) drawMini($('#heroCanvas'), heroDots, t);
  if (!$('#scr-home').hidden) drawMini($('#homeCanvas'), homeDots, t, 1.5);
  requestAnimationFrame(miniLoop);
}

/* ---------- onboarding ---------- */
$('#welcomeGo').onclick = () => show('scr-age');
$('#dob').addEventListener('input', () => {
  const v = $('#dob').value, msg = $('#ageMsg'); let ok = false;
  if (v) {
    const a = ageFrom(v);
    if (isNaN(a) || a > 110 || a < 0) msg.textContent = 'Bitte gib ein gültiges Datum ein.';
    else if (a < 14) msg.innerHTML = '<b style="color:var(--hunt)">PINGED ist erst ab 14 Jahren.</b> Du kannst leider noch kein Konto erstellen.';
    else if (a < 18) { msg.textContent = `Du bist ${a}. Im nächsten Schritt brauchen wir das Okay deiner Eltern.`; ok = true; }
    else { msg.textContent = `Du bist ${a}. Alles klar.`; ok = true; }
  }
  $('#ageGo').disabled = !ok;
});
$('#ageGo').onclick = () => {
  S.dob = $('#dob').value; S.minor = ageFrom(S.dob) < 18; save();
  show(S.minor ? 'scr-parent' : 'scr-consent');
};
$('#parentMail').addEventListener('input', () => { $('#parentSend').disabled = !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test($('#parentMail').value.trim()); });
$('#parentSend').onclick = () => { S.parent.mail = $('#parentMail').value.trim(); save(); $('#parentSent').hidden = false; $('#parentConfirm').hidden = false; toast('Bestätigungs-E-Mail angefordert (Demo)'); };
$('#parentConfirm').onclick = () => { S.parent.confirmed = true; S.parent.confirmedAt = new Date().toISOString(); save(); $('#parentGo').disabled = false; $('#parentConfirm').textContent = 'Bestätigt ✓'; $('#parentConfirm').disabled = true; };
$('#parentGo').onclick = () => show('scr-consent');

const ICONS = {
  loc: '<path d="M12 21s-6-5.3-6-11a6 6 0 0112 0c0 5.7-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
  cam: '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8 7l1.5-3h5L16 7"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
  push: '<path d="M6 16V11a6 6 0 0112 0v5l2 2H4z"/><path d="M10 20a2 2 0 004 0"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'
};
const PERMS = [
  { k: 'loc', t: 'Standort', d: 'Nur während einer laufenden Runde und nur für deine Mitspieler. Ohne Standort kein Spiel.', req: true },
  { k: 'cam', t: 'Kamera', d: 'Kurze Clips beim Catch für den Trailer. Bleiben auf deinem Handy.' },
  { k: 'mic', t: 'Mikrofon', d: 'Nur der Ton dieser Clips. Keine Gespräche.' },
  { k: 'push', t: 'Mitteilungen', d: 'Einladungen und Rundenstart.' },
  { k: 'stats', t: 'Anonyme Statistik', d: 'Welche Modi beliebt sind. Kein Tracking, keine Werbung.' }
];
function permRows(prefix) {
  return PERMS.map(p => `<div class="perm"><span class="ic"><svg viewBox="0 0 24 24">${ICONS[p.k]}</svg></span><span><b>${p.t}${p.req ? '<span class="req">PFLICHT</span>' : ''}</b><small>${p.d}</small></span><label class="switch"><input type="checkbox" id="${prefix}${p.k}" aria-label="${p.t}"${S.consents[p.k] ? ' checked' : ''}><span></span></label></div>`).join('');
}
onShow['scr-consent'] = () => {
  $('#permList').innerHTML = permRows('perm_') + '<p class="note">Dein Handy fragt danach noch einmal selbst nach. Du kannst alles jederzeit im Datenschutz-Center ändern.</p>';
  const check = () => { $('#consentGo').disabled = !($('#cAgb').checked && $('#cDs').checked && $('#cSafe').checked && $('#perm_loc').checked); };
  $$('#scr-consent input').forEach(i => i.onchange = check); check();
};
$('#consentGo').onclick = () => {
  Object.assign(S.consents, { agb: true, ds: true, safe: true, at: new Date().toISOString() });
  PERMS.forEach(p => S.consents[p.k] = $('#perm_' + p.k).checked);
  save(); show('scr-profile');
};
let pickedColor = COLORS[0];
onShow['scr-profile'] = () => {
  $('#colorPick').innerHTML = COLORS.map(c => `<button style="background:${c}" aria-label="Farbe ${c}" aria-pressed="${c === pickedColor}" data-c="${c}"></button>`).join('');
  $$('#colorPick button').forEach(b => b.onclick = () => { pickedColor = b.dataset.c; onShow['scr-profile'](); });
  if (S.minor) { $('#emergencyField').hidden = true; }
};
$('#pName').addEventListener('input', () => { $('#profileGo').disabled = $('#pName').value.trim().length < 2; });
$('#profileGo').onclick = () => {
  S.profile = { name: $('#pName').value.trim().slice(0, 14), color: pickedColor };
  S.emergency = S.minor ? S.parent.mail : $('#pEmergency').value.trim();
  S.created = new Date().toISOString(); save(); goHome();
};

/* ---------- home ---------- */
onShow['scr-home'] = () => {
  $('#homeName').textContent = S.profile.name; $('#homeDot').style.background = S.profile.color; $('#homeDot').textContent = S.profile.name.charAt(0).toUpperCase();
  const b = $('#homeBadge'); b.className = 'badge' + (S.pass ? ' pass' : S.minor ? ' minor' : '');
  b.textContent = S.pass ? 'Pass' : S.minor ? 'U18 · Free' : 'Free';
  $('#stRounds').textContent = S.stats.rounds; $('#stCatches').textContent = S.stats.catches; $('#stEscapes').textContent = S.stats.escapes;
  $('#stKm').textContent = (S.stats.meters / 1000).toFixed(1).replace('.', ',');
  $('#passMenuSub').textContent = S.pass ? 'Aktiv seit ' + new Date(S.pass.at).toLocaleDateString('de-DE') : '19,99 € einmalig, kein Abo';
};
$('#goCreate').onclick = () => { if (!S.consents.loc) return needLoc(); C = defaultsCreate(); show('scr-create'); };
$('#goJoin').onclick = () => { if (!S.consents.loc) return needLoc(); show('scr-join'); };
$('#goPass').onclick = () => show('scr-pass');
$('#goPrivacy').onclick = () => show('scr-privacy');
$('#goLegal').onclick = () => show('scr-legal');
function needLoc() {
  overlay(`<h3>Standort aus</h3><p>Du hast die Standort-Einwilligung widerrufen. Ohne Standort kann PINGED keine Pings senden.</p><button class="btn" id="ovA">Im Datenschutz-Center ändern</button><button class="btn ghost small" id="ovB">Schließen</button>`,
    c => { c.querySelector('#ovA').onclick = () => { closeOverlay(); show('scr-privacy'); }; c.querySelector('#ovB').onclick = closeOverlay; });
}

/* ---------- create ---------- */
const MODE_ICON = {
  classic: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  traitor: '<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.5"/>',
  infect: '<circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/>',
  zone: '<circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/><circle cx="12" cy="12" r="4"/>',
  mrx: '<path d="M12 3l9 18H3z"/><path d="M12 10v5M12 18v.01"/>',
  bounty: '<path d="M12 2v20M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>'
};
const MODES = [
  { k: 'classic', t: 'Klassik', d: 'Jäger gegen Läufer, Pings in festen Abständen.', pass: false },
  { k: 'traitor', t: 'Verräter', d: 'Ein Läufer spielt heimlich für die Jäger.', pass: true },
  { k: 'infect', t: 'Infektion', d: 'Wer gefangen wird, jagt ab sofort mit.', pass: true },
  { k: 'zone', t: 'Zone', d: 'Die Spielzone schrumpft bis zum Ende auf 40 %.', pass: true },
  { k: 'mrx', t: 'Mister X', d: 'Einer gegen alle. Pings zeigen nur einen Umkreis.', pass: true },
  { k: 'bounty', t: 'Kopfgeld', d: 'Jeder jagt jeden. Kommt bald.', pass: true, soon: true }
];
let C = null;
function defaultsCreate() { return { mode: 'classic', players: 6, dur: 45, ping: 3, head: 3, role: 'random', loot: false, voice: false, hostPass: !!S.pass, joined: false, host: S.profile.name }; }
function upsell(what) {
  overlay(`<h3>Im Pass drin</h3><p>${esc(what)} gehört zum PINGED Pass. Einmal 19,99 €, kein Abo, und deine ganze Lobby spielt mit.</p><button class="btn" id="ovA">Pass ansehen</button><button class="btn ghost small" id="ovB">Schließen</button>`,
    c => { c.querySelector('#ovA').onclick = () => { closeOverlay(); show('scr-pass'); }; c.querySelector('#ovB').onclick = closeOverlay; });
}
function seg(el, opts, cur, onPick) {
  el.innerHTML = opts.map(o => `<button aria-pressed="${o.v === cur}" data-v="${o.v}"${o.lock ? ' data-lock="1"' : ''}>${o.l}${o.lock ? ' 🔒' : ''}</button>`).join('');
  el.querySelectorAll('button').forEach(b => b.onclick = () => { if (b.dataset.lock) return upsell(b.dataset.v + ' Spieler'); onPick(isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v); });
}
function renderCreate() {
  const P = C.hostPass;
  $('#modes').innerHTML = MODES.map(m => `<button class="mode" aria-pressed="${C.mode === m.k}" data-k="${m.k}"${m.soon ? ' disabled' : ''}>${m.pass && !P ? '<span class="lock">PASS</span>' : ''}${m.soon ? '<span class="lock">BALD</span>' : ''}<span class="mi"><svg class="i" viewBox="0 0 24 24">${MODE_ICON[m.k]}</svg></span><b>${m.t}</b><small>${m.d}</small></button>`).join('');
  $$('#modes .mode').forEach(b => b.onclick = () => { const m = MODES.find(x => x.k === b.dataset.k); if (m.pass && !P) return upsell('Der Modus „' + m.t + '“'); C.mode = m.k; renderCreate(); });
  seg($('#segPlayers'), [4, 6, 8, 12].map(n => ({ v: n, l: n, lock: n > 6 && !P })), C.players, v => { C.players = v; renderCreate(); });
  seg($('#segDur'), [30, 45, 60].map(n => ({ v: n, l: n + ' min' })), C.dur, v => { C.dur = v; renderCreate(); });
  seg($('#segPing'), [2, 3, 5].map(n => ({ v: n, l: n + ' min' })), C.ping, v => { C.ping = v; renderCreate(); });
  seg($('#segHead'), [3, 5].map(n => ({ v: n, l: n + ' min' })), C.head, v => { C.head = v; renderCreate(); });
  seg($('#segRole'), [{ v: 'random', l: 'Zufall' }, { v: 'hunter', l: 'Jäger' }, { v: 'runner', l: C.mode === 'mrx' ? 'Mister X' : 'Läufer' }], C.role, v => { C.role = v; renderCreate(); });
  const lo = $('#optLoot'), vo = $('#optVoice');
  lo.checked = C.loot; vo.checked = C.voice;
  lo.onchange = () => { if (!P) { lo.checked = false; return upsell('Loot auf der Karte'); } C.loot = lo.checked; };
  vo.onchange = () => { if (!P) { vo.checked = false; return upsell('Die KI-Spielleitung'); } C.voice = vo.checked; if (C.voice) { audio(); say('KI-Spielleitung aktiv.'); } };
  $('#passHint').textContent = P ? 'Dein Pass ist aktiv. Alle in deiner Lobby bekommen diese Funktionen.' : 'Loot und KI-Spielleitung gibt es mit dem PINGED Pass.';
  $('#blockedList').innerHTML = WORLD.blocked.map(b => `<div><i></i>${esc(b.name)}: gesperrt, darf nicht betreten werden</div>`).join('') + '<div style="color:var(--muted)">Prüfe die Zone trotzdem selbst, bevor ihr startet.</div>';
  const night = S.minor && nightNow();
  $('#nightBlock').hidden = !night;
  $('#nightBlock').textContent = 'Zwischen 22 und 6 Uhr können Spieler unter 18 keine Runden starten. Du kannst dir alles anschauen, aber erst morgen spielen.';
  $('#createGo').disabled = night;
  requestAnimationFrame(drawZonePreview);
}
onShow['scr-create'] = renderCreate;
$('#createGo').onclick = () => { C.joined = false; C.host = S.profile.name; openLobby(); };

/* ---------- join ---------- */
$('#joinCode').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); $('#joinGo').disabled = e.target.value.length !== 6; });
$('#joinGo').onclick = () => {
  if (S.minor && nightNow()) { toast('Zwischen 22 und 6 Uhr kannst du unter 18 nicht beitreten.'); return; }
  C = { mode: 'traitor', players: 8, dur: 45, ping: 3, head: 3, role: 'random', loot: true, voice: true, hostPass: true, joined: true, host: 'Dominick', code: $('#joinCode').value };
  openLobby();
};

/* ---------- lobby ---------- */
let lobbyTimers = [];
function openLobby() {
  lobbyTimers.forEach(clearTimeout); lobbyTimers = [];
  C.code = C.code || Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  const names = BOT_NAMES.filter(n => n !== S.profile.name && n !== C.host).slice(0, C.players - (C.joined ? 2 : 1));
  C.roster = [{ name: S.profile.name, me: true, color: S.profile.color, ready: false }];
  if (C.joined) C.roster.unshift({ name: C.host, color: COLORS[1], ready: true, host: true });
  names.forEach((n, i) => C.roster.push({ name: n, color: COLORS[(i + 2) % COLORS.length], ready: false, pending: true }));
  C.play = C.play || 'demo';
  show('scr-lobby');
  $('#rcLoc').checked = false; $('#rcFilm').checked = S.consents.cam;
  renderPlayMode();
  const pend = C.roster.filter(p => p.pending);
  pend.forEach((p, i) => lobbyTimers.push(setTimeout(() => { p.pending = false; p.ready = true; renderLobby(); }, 500 + i * 380)));
  renderLobby();
}
function renderLobby() {
  const m = MODES.find(x => x.k === C.mode);
  $('#lobbyCode').textContent = C.code;
  $('#lobbyMeta').textContent = `${m.t} · ${C.dur} min · Ping alle ${C.ping} min · Host: ${C.host}${C.hostPass ? ' (Pass)' : ''}`;
  $('#rcN').textContent = C.roster.length - 1;
  $('#lobbyPlayers').innerHTML = C.roster.map(p => `<div class="pl"><span class="avatar" style="background:${p.color}">${esc(p.name.charAt(0).toUpperCase())}</span><span class="n">${esc(p.name)}${p.me ? ' (du)' : ''}${p.host ? ' · Host' : ''}</span>${p.pending ? '<span class="wait">tritt bei …</span>' : p.me ? (p.ready ? '<span class="ok">Bereit</span>' : '<span class="wait">Zustimmung fehlt</span>') : '<span class="ok">Zugestimmt</span>'}</div>`).join('');
  const all = C.roster.every(p => !p.pending);
  const me = C.roster.find(p => p.me); me.ready = $('#rcLoc').checked;
  const b = $('#lobbyGo');
  b.disabled = !(all && me.ready) || C.locating;
  b.textContent = !all ? 'Warte auf Spieler …' : !me.ready ? 'Erst zustimmen' : C.joined ? 'Bereit' : 'Runde starten';
}
$('#rcLoc').onchange = renderLobby;
function renderPlayMode() {
  $$('#playMode .pm').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === C.play)));
  const st = $('#gpsStatus');
  if (C.play === 'gps') st.textContent = C.locating ? 'Suche deinen Standort …' : C.origin ? `Standort gefunden (± ${Math.round(C.accuracy || 0)} m). Die Spielzone liegt um dich herum.` : '';
  else st.textContent = mapsReady() ? 'Demo auf echter Karte rund um den Alexanderplatz. Tippe auf die Karte, um zu laufen.' : 'Demo auf der Beispielkarte. Tippe auf die Karte, um zu laufen.';
}
$$('#playMode .pm').forEach(b => b.onclick = () => {
  if (b.dataset.v === 'demo') { C.play = 'demo'; renderPlayMode(); renderLobby(); return; }
  if (!('geolocation' in navigator)) { toast('Dein Gerät kann keinen Standort liefern.'); return; }
  C.play = 'gps'; C.locating = true; renderPlayMode(); renderLobby();
  try {
    navigator.geolocation.getCurrentPosition(pos => {
      C.locating = false; C.origin = { lat: pos.coords.latitude, lng: pos.coords.longitude }; C.accuracy = pos.coords.accuracy;
      renderPlayMode(); renderLobby();
    }, err => {
      C.locating = false; C.play = 'demo'; C.origin = null; renderPlayMode(); renderLobby();
      toast(err && err.code === 1 ? 'Standort nicht erlaubt. Erlaube ihn in den Browser-Einstellungen.' : 'Standort nicht verfügbar. Hier geht nur die Demo.');
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 });
  } catch (e) { C.locating = false; C.play = 'demo'; renderPlayMode(); renderLobby(); toast('Standort nicht verfügbar. Hier geht nur die Demo.'); }
});
$('#lobbyGo').onclick = () => {
  audio();
  if (C.joined) { $('#lobbyGo').disabled = true; $('#lobbyGo').textContent = 'Dominick startet …'; setTimeout(startRound, 1100); }
  else startRound();
};

/* ---------- game state ---------- */
let G = { running: false };
const SPEED_BASE = 10;
function startRound() {
  const n = C.roster.length, rnd = Math.random;
  const ents = C.roster.map((p, i) => ({ id: i, name: p.name, color: p.color, me: !!p.me, team: 'runner', traitor: false, x: (rnd() - .5) * 16, y: (rnd() - .5) * 16, tx: null, ty: null, caught: false, catches: 0, meters: 0, intel: null, nextThink: 0, outT: 0, film: p.me ? $('#rcFilm').checked : true }));
  const me = ents.find(e => e.me);
  let hunters;
  if (C.mode === 'mrx') {
    const x = C.role === 'runner' ? me : C.role === 'hunter' ? ents.filter(e => !e.me)[Math.floor(rnd() * (n - 1))] : ents[Math.floor(rnd() * n)];
    ents.forEach(e => e.team = e === x ? 'runner' : 'hunter'); x.mrx = true;
  } else {
    const hc = Math.max(1, Math.round(n / 3));
    let pool = ents.slice().sort(() => rnd() - .5);
    if (C.role === 'hunter') pool = [me, ...pool.filter(e => e !== me)];
    if (C.role === 'runner') pool = [...pool.filter(e => e !== me), me];
    hunters = pool.slice(0, hc); hunters.forEach(e => e.team = 'hunter');
    if (C.mode === 'traitor') {
      const runners = ents.filter(e => e.team === 'runner');
      const t = runners[Math.floor(rnd() * runners.length)]; t.traitor = true;
    }
  }
  G = {
    running: false, paused: false, mode: C.mode, ents, me, t: 0, dur: C.dur * 60, ping: C.ping * 60, head: C.head * 60,
    nextPing: C.head * 60 + C.ping * 60, pass: C.hostPass, voice: C.hostPass && C.voice, loot: C.hostPass && C.loot,
    markers: [], crates: [], items: [], effects: { scan: 0, drone: 0, invis: false, fake: null }, betrayCd: 0,
    banner: null, events: [], rec: [], recT: 0, speed: 1, lastSay: 0, heartT: 0, warned30: false, said5: false, result: null,
    zoneR: R0, started: performance.now(), view: null,
    useMap: mapsReady(), gps: C.play === 'gps' && !!C.origin, origin: (C.play === 'gps' && C.origin) || DEFAULT_ORIGIN, watch: null
  };
  if (G.loot) { const r = rng(Math.floor(Math.random() * 1e9)); while (G.crates.length < 7) { const a = r() * 6.283, d = 60 + r() * 230, p = { x: Math.cos(a) * d, y: Math.sin(a) * d }; if (!inBlocked(p, 8)) G.crates.push(p); } }
  showRole();
}
function roleOf(e) { if (e.team === 'hunter') return 'hunter'; if (e.traitor) return 'traitor'; return 'runner'; }
const ROLE_TXT = {
  hunter: { t: 'Jäger', d: 'Du siehst die Läufer nur bei Pings. Lauf zur letzten Position, komm nah ran und tippe auf FANGEN.' },
  runner: { t: 'Läufer', d: 'Hau ab. Alle paar Minuten sehen die Jäger, wo du bist. Der Kompass zeigt dir, aus welcher Richtung Gefahr kommt.' },
  traitor: { t: 'Verräter', d: 'Du bist Läufer, aber du arbeitest für die Jäger. Nutze VERRATEN, um ihnen einen Läufer zu zeigen. Niemand darf es merken.' },
  mrx: { t: 'Mister X', d: 'Du allein gegen alle. Pings zeigen nur einen Umkreis, nicht deinen genauen Standort. Überlebe bis zum Ende.' }
};
function showRole() {
  const r = G.me.mrx ? 'mrx' : roleOf(G.me), info = ROLE_TXT[r];
  const card = $('#roleCard');
  card.className = 'rolecard ' + (r === 'mrx' ? 'runner' : r);
  const glyph = { hunter: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>', runner: '<circle cx="14" cy="4.5" r="2"/><path d="M8 21l3-6 3 2v5M6 12l3-4 4 1 3 4 3 1"/>', traitor: '<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.5"/><path d="M4 4l16 16"/>', mrx: '<path d="M12 3l9 18H3z"/><path d="M12 10v5M12 18v.01"/>' }[r];
  const howMove = G.gps ? 'Lauf los, dein GPS bewegt dich auf der Karte.' : 'Tippe auf die Karte, um dorthin zu laufen.';
  card.innerHTML = `<span class="glyph"><svg class="i" viewBox="0 0 24 24">${glyph}</svg></span><span class="eyebrow">Modus ${MODES.find(m => m.k === G.mode).t}</span><span class="big">${info.t}</span><p>${info.d}</p><p class="note">${r === 'hunter' ? `Die Läufer haben ${C.head} Minuten Vorsprung. Du wartest am Start.` : `Du hast ${C.head} Minuten Vorsprung. ${howMove}`}</p>`;
  card.classList.remove('show'); void card.offsetWidth; card.classList.add('show');
  show('scr-role');
  if (G.voice) say(`Du bist ${info.t}.`);
}
$('#roleGo').onclick = () => { audio(); beginGame(); };

function beginGame() {
  $('#game').hidden = false; document.body.style.overflow = 'hidden';
  G.running = true; G.last = performance.now();
  const m = MODES.find(x => x.k === G.mode);
  $('#hudMode').textContent = m.t + (G.gps ? ' · GPS' : ' · Demo');
  $('#btnSpeed').textContent = '×1'; $('#btnSpeed').disabled = G.gps;
  $('#game').classList.toggle('gmap', G.useMap);
  if (G.useMap && !setupMap()) { G.useMap = false; $('#game').classList.remove('gmap'); }
  if (G.gps) startGps();
  try { navigator.wakeLock && navigator.wakeLock.request('screen').then(l => G.wake = l, () => {}); } catch (e) {}
  setBanner(roleOf(G.me) === 'hunter' ? 'Vorsprung läuft' : 'Lauf!', roleOf(G.me) === 'hunter' ? '' : 'green');
  say(roleOf(G.me) === 'hunter' ? `Runde gestartet. Die Läufer haben ${C.head} Minuten Vorsprung.` : `Runde gestartet. Du hast ${C.head} Minuten Vorsprung. Lauf.`);
  sfx.ping();
  resizeGame(); renderItems();
  requestAnimationFrame(loop);
}
function setBanner(text, kind = '') {
  const b = $('#hudBanner'); b.textContent = text; b.className = 'island anim ' + kind; b.hidden = false;
  void b.offsetWidth; G.bannerUntil = performance.now() + 2600;
  try { navigator.vibrate && navigator.vibrate(kind === 'red' ? [80, 60, 80] : 40); } catch (e) {}
}

/* ---------- game view ---------- */
const GC = $('#gameCanvas');
let worldLayer = null;
function resizeGame() {
  const { W, H } = fitCanvas(GC);
  if (G.useMap) { G.view = { W, H, cx: W / 2, cy: H / 2, s: 1 }; worldLayer = null; return; }
  const top = 150, bottom = 190, avail = Math.max(180, Math.min(W - 16, H - top - bottom));
  const s = avail / (2 * R0);
  G.view = { cx: W / 2, cy: top + (H - top - bottom) / 2, s, W, H };
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  worldLayer = document.createElement('canvas'); worldLayer.width = W * dpr; worldLayer.height = H * dpr;
  const wc = worldLayer.getContext('2d'); wc.setTransform(dpr, 0, 0, dpr, 0, 0); drawWorld(wc, G.view, W, H);
}
window.addEventListener('resize', () => { if (G.running) resizeGame(); });
function toWorld(px, py) { const v = G.view; return { x: (px - v.cx) / v.s, y: (py - v.cy) / v.s }; }
function tryMoveTo(p) {
  if (!G.running || G.paused) return;
  const me = G.me; if (me.caught && G.mode !== 'infect') return;
  if (G.gps) { toast('Im echten Spiel bewegst du dich, indem du läufst.'); return; }
  if (me.team === 'hunter' && G.t < G.head) { toast('Warte, bis der Vorsprung vorbei ist.'); return; }
  const b = inBlocked(p);
  if (b) { toast(b.name + ' ist gesperrt.'); return; }
  me.tx = p.x; me.ty = p.y;
}
GC.addEventListener('pointerdown', e => {
  if (G.useMap) return;
  const r = GC.getBoundingClientRect(); tryMoveTo(toWorld(e.clientX - r.left, e.clientY - r.top));
});

/* ---------- Karte (MapLibre + OpenFreeMap, gratis, ohne Schlüssel) + GPS ---------- */
const MAPLIB = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl';
const MAP_STYLE_URL = CFG.mapStyle || 'https://tiles.openfreemap.org/styles/liberty';
const GM = { map: null, style: null, loading: null };
function mapsReady() { return !!(window.maplibregl && GM.style); }
function loadScript(src) {
  return new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = src; sc.async = true; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); });
}
function loadMap() {
  if (mapsReady()) return Promise.resolve();
  if (GM.loading) return GM.loading;
  const lnk = document.createElement('link'); lnk.rel = 'stylesheet'; lnk.href = MAPLIB + '.css'; document.head.appendChild(lnk);
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000));
  GM.loading = Promise.race([Promise.all([
    window.maplibregl ? Promise.resolve() : loadScript(MAPLIB + '.js'),
    fetch(MAP_STYLE_URL).then(r => { if (!r.ok) throw new Error('style'); return r.json(); })
  ]), timeout]).then(([, style]) => { GM.style = darkStyle(style); })
    .catch(e => { GM.loading = null; throw e; });
  return GM.loading;
}
// Färbt den hellen OpenFreeMap-Stil in das PINGED-Dunkel um
function darkStyle(st) {
  const P = (l, k, v) => { l.paint = l.paint || {}; l.paint[k] = v; };
  const hide = l => { l.layout = l.layout || {}; l.layout.visibility = 'none'; };
  for (const l of st.layers) {
    const id = l.id.toLowerCase();
    if (l.type === 'background') P(l, 'background-color', '#0b0c0f');
    else if (l.type === 'fill') {
      if (l.paint) delete l.paint['fill-pattern'];
      P(l, 'fill-color', /water/.test(id) ? '#0a1620' : /park|wood|grass|wetland|pitch|cemetery|landcover|natural|forest/.test(id) ? '#0e1813' : /building/.test(id) ? '#17181d' : '#101115');
      P(l, 'fill-outline-color', 'rgba(0,0,0,0)');
    }
    else if (l.type === 'fill-extrusion') { P(l, 'fill-extrusion-color', '#1b1d23'); P(l, 'fill-extrusion-opacity', .9); }
    else if (l.type === 'line') {
      if (l.paint) delete l.paint['line-pattern'];
      if (/boundary|admin/.test(id)) { hide(l); continue; }
      P(l, 'line-color', /water|river|stream|canal|ditch|drain/.test(id) ? '#0d1a26'
        : /rail|transit|subway|tram/.test(id) ? '#2b1e1c'
        : /casing/.test(id) ? '#0b0c0f'
        : /motorway|trunk/.test(id) ? '#3a2a26'
        : /primary|secondary|tertiary/.test(id) ? '#2a2d34'
        : /path|foot|pedestrian|track|steps|cycle/.test(id) ? '#1d1f24' : '#23262c');
    }
    else if (l.type === 'symbol') {
      if (/poi|shield|oneway|airport|aerodrome|country|state|continent/.test(id) || !(l.layout && l.layout['text-field'])) { hide(l); continue; }
      if (l.layout) delete l.layout['icon-image'];
      P(l, 'text-color', /water/.test(id) ? '#2c4a63' : '#6b6d75');
      P(l, 'text-halo-color', '#0b0c0f'); P(l, 'text-halo-width', 1.2);
    }
    else if (l.type === 'raster' || l.type === 'hillshade') hide(l);
  }
  return st;
}
const M_LAT = 111320;
function toLL(p) { const o = G.origin; return { lat: o.lat - p.y / M_LAT, lng: o.lng + p.x / (M_LAT * Math.cos(o.lat * Math.PI / 180)) }; }
function fromLL(ll) { const o = G.origin; return { x: (ll.lng - o.lng) * M_LAT * Math.cos(o.lat * Math.PI / 180), y: (o.lat - ll.lat) * M_LAT }; }
const lngLat = p => { const ll = toLL(p); return [ll.lng, ll.lat]; };
function setupMap() {
  try {
    if (!GM.map) {
      GM.map = new maplibregl.Map({
        container: $('#gameMap'), style: GM.style, center: [G.origin.lng, G.origin.lat], zoom: 16,
        attributionControl: false, dragRotate: false, pitchWithRotate: false, touchPitch: false, keyboard: false, fadeDuration: 0
      });
      GM.map.touchZoomRotate.disableRotation();
      GM.map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right');
      GM.map.on('click', ev => { if (G.running) tryMoveTo(fromLL(ev.lngLat)); });
    }
    GM.map.resize();
    GM.map.jumpTo({ center: [G.origin.lng, G.origin.lat] });
    GM.map.fitBounds([lngLat({ x: -R0, y: R0 }), lngLat({ x: R0, y: -R0 })], { padding: { top: 150, bottom: 210, left: 10, right: 10 }, duration: 0 });
    return true;
  } catch (e) { GM.map = null; return false; }
}
function mapView() {
  if (!GM.map) return null;
  const T = p => { const pt = GM.map.project(lngLat(p)); return [pt.x, pt.y]; };
  const a = T({ x: 0, y: 0 }), b = T({ x: 100, y: 0 });
  return { T, cx: a[0], cy: a[1], s: Math.hypot(b[0] - a[0], b[1] - a[1]) / 100, W: G.view.W, H: G.view.H };
}
function startGps() {
  const me = G.me; let last = null;
  me.x = 0; me.y = 0;
  try {
    G.watch = navigator.geolocation.watchPosition(pos => {
      const p = fromLL({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      if (last) { const d = Math.hypot(p.x - last.x, p.y - last.y); if (d > 2 && d < 80) me.meters += d; }
      last = p; me.x = p.x; me.y = p.y; me.acc = pos.coords.accuracy; G.gpsAt = performance.now();
    }, () => toast('GPS-Signal verloren. Bleib kurz stehen.'), { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 });
  } catch (e) { toast('GPS nicht verfügbar.'); }
}
function stopGps() { if (G.watch != null) { try { navigator.geolocation.clearWatch(G.watch); } catch (e) {} G.watch = null; } }

/* ---------- simulation ---------- */
function zoneR() {
  if (G.mode !== 'zone' || G.t < G.head) return R0;
  return R0 * (1 - .6 * clamp((G.t - G.head) / (G.dur - G.head), 0, 1));
}
function moveTo(e, speed, dt) {
  if (e.tx == null) return true;
  const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy);
  if (d < 1.5) { e.tx = e.ty = null; return true; }
  const st = Math.min(d, speed * dt), nx = e.x + dx / d * st, ny = e.y + dy / d * st;
  if (inBlocked({ x: nx, y: ny })) {
    // slide around blocked area
    if (!inBlocked({ x: nx, y: e.y })) { e.meters += Math.abs(nx - e.x); e.x = nx; return false; }
    if (!inBlocked({ x: e.x, y: ny })) { e.meters += Math.abs(ny - e.y); e.y = ny; return false; }
    e.tx = e.ty = null; if (e.me) toast('Gesperrter Bereich. Such dir einen anderen Weg.'); return true;
  }
  e.meters += st; e.x = nx; e.y = ny; return false;
}
function randPointNear(x, y, rad, zr) {
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * 6.283, d = Math.random() * rad, p = { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d };
    if (Math.hypot(p.x, p.y) < zr - 12 && !inBlocked(p, 6)) return p;
  }
  const a = Math.random() * 6.283, d = Math.random() * (zr - 30); return { x: Math.cos(a) * d, y: Math.sin(a) * d };
}
function nearest(e, list) { let best = null, bd = 1e9; for (const o of list) { const d = dist(e, o); if (d < bd) { bd = d; best = o; } } return [best, bd]; }
const activeRunners = () => G.ents.filter(e => e.team === 'runner' && !e.caught);
const hunters = () => G.ents.filter(e => e.team === 'hunter' && !e.caught);

function think(e) {
  const zr = zoneR();
  if (e.team === 'runner') {
    const [h, hd] = nearest(e, hunters());
    if (h && hd < 95 && G.t >= G.head) {
      const dx = e.x - h.x, dy = e.y - h.y, d = Math.hypot(dx, dy) || 1;
      let p = { x: e.x + dx / d * 130, y: e.y + dy / d * 130 };
      if (Math.hypot(p.x, p.y) > zr - 15) p = randPointNear(e.x * .4, e.y * .4, 120, zr);
      if (inBlocked(p, 6)) p = randPointNear(e.x, e.y, 120, zr);
      e.tx = p.x; e.ty = p.y; e.run = 2.7; e.nextThink = G.t + 12;
    } else {
      const base = e.pingedAt && G.t - e.pingedAt < 40 ? { x: -e.x * .5, y: -e.y * .5 } : { x: e.x, y: e.y };
      const p = randPointNear(base.x, base.y, 170, zr); e.tx = p.x; e.ty = p.y; e.run = G.t < G.head ? 2.3 : 1.5; e.nextThink = G.t + 25 + Math.random() * 30;
    }
  } else {
    const rs = activeRunners();
    const seen = rs.filter(r => dist(r, e) < 45);
    if (seen.length) { const [r] = nearest(e, seen); e.tx = r.x; e.ty = r.y; e.run = 2.9; e.nextThink = G.t + 3; return; }
    // pick intel: freshest marker, prefer the one other hunters are not chasing
    const others = hunters().filter(h => h !== e && h.goal);
    let best = null, bs = -1e9;
    for (const m of G.markers) {
      if (!m.forHunters) continue;
      const age = G.t - m.t, taken = others.some(o => o.goal === m.eid);
      const sc = -age * .8 - dist(e, m) * .5 - (taken ? 150 : 0);
      if (sc > bs) { bs = sc; best = m; }
    }
    if (best && G.t - best.t < G.ping * 1.2) {
      e.goal = best.eid; const p = randPointNear(best.x, best.y, best.fuzzy ? 70 : 25, zr); e.tx = p.x; e.ty = p.y; e.run = 2.5; e.nextThink = G.t + 15;
    } else { e.goal = null; const p = randPointNear(e.x, e.y, 150, zr); e.tx = p.x; e.ty = p.y; e.run = 1.8; e.nextThink = G.t + 20; }
  }
}
function addMarker(e, opts = {}) {
  let x = e.x, y = e.y, fuzzy = false;
  if (opts.fake) { x = opts.fake.x; y = opts.fake.y; }
  if (e.mrx && !opts.live) { fuzzy = true; const a = Math.random() * 6.283, d = Math.random() * 55; x += Math.cos(a) * d; y += Math.sin(a) * d; }
  G.markers = G.markers.filter(m => !(m.eid === e.id && m.kind === (opts.kind || 'ping')));
  G.markers.push({ eid: e.id, name: e.name, x, y, t: G.t, kind: opts.kind || 'ping', fuzzy, forHunters: true });
}
function doPing(extra = false) {
  const rs = activeRunners(), me = G.me;
  let n = 0;
  for (const r of rs) {
    if (r.me && G.effects.invis) continue;
    if (r.me && G.effects.fake) { addMarker(r, { fake: G.effects.fake }); n++; continue; }
    addMarker(r); r.pingedAt = G.t; n++;
  }
  if (G.effects.invis && !extra) { G.effects.invis = false; if (me.team === 'runner') toast('Du warst bei diesem Ping unsichtbar.'); }
  if (G.effects.fake && !extra) { G.effects.fake = null; if (me.team === 'runner') toast('Fake-Ping gesendet. Die Jäger suchen an der falschen Stelle.'); }
  G.events.push({ t: G.t, type: 'ping', n });
  if (me.team === 'hunter' || me.traitor) { setBanner('Ping erkannt'); sfx.ping(); say(n === 1 ? 'Ping. Ein Läufer geortet.' : `Ping. ${n} Läufer geortet.`); }
  else if (!me.caught) { setBanner(me.mrx ? 'Umkreis gesendet' : 'Du wurdest gepingt', 'red'); sfx.pinged(); say('Du wurdest gepingt. Bleib in Bewegung.'); }
  else { setBanner('Ping erkannt'); sfx.ping(); }
  // bot traitor leaks
  const tr = G.ents.find(e => e.traitor && !e.me && !e.caught);
  if (tr && Math.random() < .55) {
    const victims = activeRunners().filter(r => r !== tr);
    const [v] = nearest(tr, victims);
    if (v) setTimeout(() => leak(v, false), 1200);
  }
}
function leak(v, byMe) {
  if (!G.running) return;
  G.markers.push({ eid: v.id, name: v.name, x: v.x, y: v.y, t: G.t, kind: 'tip', forHunters: true });
  G.events.push({ t: G.t, type: 'tip', name: v.name });
  if (G.me.team === 'hunter') { setBanner('Anonymer Tipp'); sfx.loot(); say(`Anonymer Tipp. ${v.name} wurde verraten.`); }
  else if (byMe) { toast(`${v.name} an die Jäger verraten.`); }
  else if (v.me) { setBanner('Jemand hat dich verraten', 'red'); sfx.pinged(); say('Achtung. Jemand hat dich verraten.'); }
}
function catchRunner(h, r) {
  r.caught = true; r.caughtBy = h.name; r.caughtAt = G.t; h.catches++;
  G.events.push({ t: G.t, type: 'catch', name: r.name, by: h.name, x: r.x, y: r.y });
  G.markers = G.markers.filter(m => m.eid !== r.id);
  if (G.mode === 'infect') { r.caught = false; r.team = 'hunter'; r.infected = true; }
  const left = activeRunners().filter(x => !x.traitor).length;
  sfx.catch();
  if (r.me) { setBanner(G.mode === 'infect' ? 'Infiziert, jetzt jagst du' : 'Gefangen', 'red'); say(G.mode === 'infect' ? 'Du wurdest infiziert. Jetzt jagst du mit.' : `${h.name} hat dich gefangen.`); }
  else { setBanner(`${r.name} gefangen`, h.me ? 'green' : 'red'); say(`${r.name} wurde gefangen. Noch ${left} Läufer.`); }
  if (h.me) S.stats.catches++;
  renderItems();
}
function step(dt) {
  G.t += dt;
  const me = G.me, zr = zoneR(); G.zoneR = zr;
  if (G.betrayCd > 0) G.betrayCd -= dt;
  if (G.effects.scan > 0) G.effects.scan -= dt;
  if (G.effects.drone > 0) G.effects.drone -= dt;
  // hunt start
  if (G.t >= G.head && !G.huntStarted) { G.huntStarted = true; setBanner('Die Jagd beginnt', me.team === 'hunter' ? '' : 'red'); sfx.beat(); say('Vorsprung vorbei. Die Jagd beginnt.'); G.events.push({ t: G.t, type: 'hunt' }); }
  // pings
  if (G.t >= G.nextPing - 30 && !G.warned30 && G.t < G.nextPing) { G.warned30 = true; say('Ping in 30 Sekunden.'); }
  if (G.t >= G.nextPing) { doPing(); G.nextPing += G.ping; G.warned30 = false; }
  if (!G.said5 && G.dur - G.t <= 300) { G.said5 = true; say('Noch fünf Minuten.'); }
  // entities
  for (const e of G.ents) {
    if (e.caught) continue;
    const frozen = e.team === 'hunter' && G.t < G.head;
    if (e.me) { if (!frozen) moveTo(e, 2.4, dt); }
    else if (!frozen) {
      if (G.t >= e.nextThink || e.tx == null) think(e);
      if (moveTo(e, e.run || 1.6, dt)) e.nextThink = Math.min(e.nextThink, G.t + 2);
    }
    // outside zone → live ping for hunters
    if (e.team === 'runner') {
      if (Math.hypot(e.x, e.y) > zr) { e.outT += dt; if (e.outT > 30) { addMarker(e, { kind: 'out', live: true }); } if (!e.me) { const p = randPointNear(0, 0, zr * .6, zr); e.tx = p.x; e.ty = p.y; } }
      else e.outT = 0;
    }
  }
  // catches
  if (G.t >= G.head) for (const h of hunters()) {
    if (h.me) continue;
    for (const r of activeRunners()) if (dist(h, r) < 7 && !(r.traitor && Math.random() < .5)) { catchRunner(h, r); break; }
  }
  // crates
  if (G.loot && !me.caught) G.crates = G.crates.filter(c => {
    if (Math.hypot(c.x - me.x, c.y - me.y) > 14) return true;
    const pool = me.team === 'hunter' ? ['drone', 'xping'] : ['fake', 'invis', 'scan'];
    const it = pool[Math.floor(Math.random() * pool.length)]; G.items.push(it); sfx.loot();
    toast('Loot: ' + ITEM[it].t); renderItems(); return false;
  });
  // record
  if (G.t >= G.recT) { G.recT = G.t + 3; G.rec.push({ t: G.t, p: G.ents.map(e => [Math.round(e.x), Math.round(e.y), e.team === 'hunter' ? 1 : 0, e.caught ? 1 : 0]) }); }
  // end conditions
  const left = activeRunners().filter(r => !r.traitor);
  if (left.length === 0 && G.t > G.head) return endRound('hunters');
  if (G.t >= G.dur) return endRound('runners');
}

/* ---------- items ---------- */
const ITEM = {
  fake: { t: 'Fake-Ping', d: 'Nächster Ping zeigt dich 120 m weiter weg.' },
  invis: { t: 'Unsichtbar', d: 'Du fehlst beim nächsten Ping.' },
  scan: { t: 'Scan', d: '40 Sekunden alle Jäger sehen.' },
  drone: { t: 'Drohne', d: '30 Sekunden alle Läufer live sehen.' },
  xping: { t: 'Extra-Ping', d: 'Sofort alle Läufer orten.' }
};
function useItem(i) {
  const it = G.items[i]; G.items.splice(i, 1);
  const me = G.me;
  if (it === 'fake') { G.effects.fake = randPointNear(me.x, me.y, 160, zoneR()); toast('Fake-Ping ist scharf für den nächsten Ping.'); }
  if (it === 'invis') { G.effects.invis = true; toast('Beim nächsten Ping bist du unsichtbar.'); }
  if (it === 'scan') { G.effects.scan = 40; say('Scan aktiv.'); }
  if (it === 'drone') { G.effects.drone = 30; setBanner('Drohne in der Luft'); say('Drohne in der Luft. Alle Läufer sichtbar.'); }
  if (it === 'xping') { doPing(true); }
  sfx.loot(); renderItems();
}
function renderItems() {
  const me = G.me, box = $('#hudItems'); if (!box) return;
  let html = G.items.map((it, i) => `<button class="hot" data-i="${i}">${ITEM[it].t}</button>`).join('');
  if (me.traitor && !me.caught) html += `<button class="hot" id="btnBetray"${G.betrayCd > 0 || G.t < G.head ? ' disabled' : ''}>Verraten</button>`;
  if ((me.caught && G.mode !== 'infect')) html += `<button id="btnSkip">Vorspulen ×8</button>`;
  box.innerHTML = html;
  box.querySelectorAll('[data-i]').forEach(b => b.onclick = () => useItem(+b.dataset.i));
  const bt = $('#btnBetray'); if (bt) bt.onclick = () => {
    const victims = activeRunners().filter(r => r !== me); const [v] = nearest(me, victims);
    if (v) { leak(v, true); G.betrayCd = G.ping; renderItems(); }
  };
  const sk = $('#btnSkip'); if (sk) sk.onclick = () => { G.speed = 8; $('#btnSpeed').textContent = '×8'; };
}
function catchable() {
  const me = G.me; if (me.team !== 'hunter' || G.t < G.head || me.caught) return null;
  const [r, d] = nearest(me, activeRunners()); return r && d < 14 ? r : null;
}

/* ---------- render ---------- */
function visibleTo(me, e) {
  if (e === me) return true;
  if (me.caught && G.mode !== 'infect') return true;
  if (me.traitor) return true;
  if (me.team === 'hunter') { if (e.team === 'hunter') return true; return dist(me, e) < 30 || G.effects.drone > 0; }
  if (e.team === 'runner') return true;
  return dist(me, e) < 30 || G.effects.scan > 0;
}
let LBL = null; // belegte Label-Flächen im aktuellen Frame, damit sich Namen nicht überlappen
function label(ctx, text, x, y, fg = '#f4f4f6', bg = 'rgba(10,11,14,.78)', font = '600 11px "Geist", system-ui, sans-serif') {
  ctx.font = font; const w = ctx.measureText(text).width + 14, h = 20;
  if (LBL) {
    const hit = yy => LBL.some(r => Math.abs(r.x - x) < (r.w + w) / 2 + 2 && Math.abs(r.y - yy) < h + 1);
    if (hit(y) && text !== 'Du') return; // lieber weglassen als übereinander stapeln
    LBL.push({ x, y, w });
  }
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - h / 2, w, h, 10) : ctx.rect(x - w / 2, y - h / 2, w, h); ctx.fill();
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + .5); ctx.textBaseline = 'alphabetic';
}
function drawGame() {
  let v = G.view; const { W, H } = v, ctx = GC.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  let T;
  if (G.useMap) { const mv = mapView(); if (!mv) return; v = mv; T = mv.T; }
  else { ctx.drawImage(worldLayer, 0, 0, W, H); T = p => [v.cx + p.x * v.s, v.cy + p.y * v.s]; }
  drawZone(ctx, v, W, H, G.zoneR);
  LBL = [];
  const me = G.me, now = performance.now();
  // start marker
  { const [x, y] = T({ x: 0, y: 0 }); ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.strokeStyle = 'rgba(255,214,10,.6)'; ctx.lineWidth = 2; ctx.stroke(); }
  // crates
  for (const c of G.crates) {
    const [x, y] = T(c), bob = Math.sin(now / 400 + c.x) * 2;
    ctx.save(); ctx.shadowColor = TAPE; ctx.shadowBlur = 14; ctx.fillStyle = TAPE;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 8, y - 8 + bob, 16, 16, 5) : ctx.rect(x - 8, y - 8 + bob, 16, 16); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#141100'; ctx.font = '800 11px "Geist", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', x, y + bob + .5); ctx.textBaseline = 'alphabetic';
  }
  // markers (only for hunter-side viewers)
  const hunterView = me.team === 'hunter' || me.traitor || (me.caught && G.mode !== 'infect');
  if (hunterView) for (const m of G.markers) {
    const age = G.t - m.t; if (age > G.ping * 1.3) continue;
    const a = clamp(1 - age / (G.ping * 1.3), .3, 1), [x, y] = T(m);
    const col = m.kind === 'tip' ? TAPE : m.kind === 'out' ? HUNT : RUN;
    if (m.fuzzy) { ctx.beginPath(); ctx.arc(x, y, 60 * v.s, 0, 7); ctx.fillStyle = `rgba(50,215,75,${.12 * a})`; ctx.fill(); ctx.strokeStyle = `rgba(50,215,75,${.5 * a})`; ctx.setLineDash([4, 5]); ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]); }
    for (let k = 0; k < 2; k++) {
      const pulse = ((now / 1000 + k * .8) % 1.6) / 1.6;
      ctx.globalAlpha = a * (1 - pulse); ctx.beginPath(); ctx.arc(x, y, 9 + pulse * 26, 0, 7); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.globalAlpha = a; ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fillStyle = col; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fillStyle = '#0b0c0f'; ctx.fill();
    const lbl = m.kind === 'tip' ? 'Tipp' : m.kind === 'out' ? 'Außerhalb' : 'Ping';
    label(ctx, m.name, x, y - 22);
    label(ctx, `${lbl} · ${age < 30 ? 'jetzt' : 'vor ' + Math.max(1, Math.round(age / 60)) + ' min'}`, x, y + 22, col, 'rgba(10,11,14,.78)', '500 10px "Geist", sans-serif');
    ctx.globalAlpha = 1;
  }
  // my target line
  if (me.tx != null) { const [a, b] = T(me), [c, d] = T({ x: me.tx, y: me.ty }); ctx.setLineDash([2, 6]); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(244,244,246,.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(c, d, 5, 0, 7); ctx.strokeStyle = '#f4f4f6'; ctx.lineWidth = 2; ctx.stroke(); }
  // entities
  for (const e of G.ents) {
    if (!visibleTo(me, e)) continue;
    const [x, y] = T(e);
    if (e.caught) ctx.globalAlpha = .35;
    const col = e.team === 'hunter' ? HUNT : e.color;
    if (e === me) {
      if (G.gps && me.acc) { ctx.beginPath(); ctx.arc(x, y, Math.min(120, me.acc * v.s), 0, 7); ctx.fillStyle = 'rgba(10,132,255,.12)'; ctx.fill(); }
      const pr = (now % 2000) / 2000; ctx.beginPath(); ctx.arc(x, y, 12 + pr * 16, 0, 7); ctx.fillStyle = `rgba(244,244,246,${.18 * (1 - pr)})`; ctx.fill();
    }
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(x, y, e === me ? 10 : 8, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.arc(x, y, e === me ? 7 : 5.5, 0, 7); ctx.fillStyle = col; ctx.fill();
    let tag = e === me ? 'Du' : e.name;
    if ((me.traitor || (me.caught && G.mode !== 'infect')) && e.traitor && e !== me) tag += ' · Verräter';
    if (e.caught) tag += ' · gefangen';
    label(ctx, tag, x, y - 20, e === me ? '#0b0c0f' : '#f4f4f6', e === me ? '#f4f4f6' : 'rgba(10,11,14,.78)');
    ctx.globalAlpha = 1;
  }
  LBL = null;
  if (G.effects.scan > 0 || G.effects.drone > 0) { ctx.fillStyle = 'rgba(255,214,10,.05)'; ctx.fillRect(0, 0, W, H); }
}
function updateHud() {
  const me = G.me;
  const r = me.caught && G.mode !== 'infect' ? 'Zuschauer' : me.team === 'hunter' ? (me.infected ? 'Infiziert' : 'Jäger') : me.mrx ? 'Mister X' : me.traitor ? 'Verräter' : 'Läufer';
  $('#hudRole').textContent = r;
  $('#hudDot').style.background = me.team === 'hunter' ? HUNT : me.traitor ? TAPE : r === 'Zuschauer' ? '#8d8e96' : RUN;
  $('#hudClock').textContent = fmt(G.dur - G.t);
  let frac;
  if (G.t < G.head) { $('#hudNextLbl').textContent = 'Jagd startet in'; $('#hudNext').textContent = fmt(G.head - G.t); frac = 1 - G.t / G.head; }
  else { $('#hudNextLbl').textContent = 'Nächster Ping'; $('#hudNext').textContent = fmt(G.nextPing - G.t); frac = (G.nextPing - G.t) / G.ping; }
  $('#pingRing').style.strokeDashoffset = String(150.8 * (1 - clamp(frac, 0, 1)));
  const rs = G.ents.filter(e => e.team === 'runner'), alive = rs.filter(e => !e.caught).length;
  let info = `${alive} von ${rs.length} Läufern frei · ${G.ents.filter(e => e.team === 'hunter').length} Jäger`;
  if (G.mode === 'zone' && G.t > G.head) info += ` · Zone ${Math.round(G.zoneR)} m`;
  if (G.effects.scan > 0) info += ` · Scan ${Math.ceil(G.effects.scan)} s`;
  if (G.effects.drone > 0) info += ` · Drohne ${Math.ceil(G.effects.drone)} s`;
  if (G.gps && G.gpsAt && performance.now() - G.gpsAt > 20000) info = '<span style="color:#ffb340">Warte auf GPS-Signal …</span>';
  if (me.team === 'runner' && !me.caught && me.outT > 0) info = `<span style="color:var(--hunt);font-weight:600">Außerhalb der Zone · live sichtbar in ${Math.max(0, Math.ceil(30 - me.outT))} s</span>`;
  $('#hudInfo').innerHTML = info;
  if (performance.now() > (G.bannerUntil || 0)) $('#hudBanner').hidden = true;
  const comp = $('#hudCompass');
  if (me.team === 'runner' && !me.caught && G.t >= G.head) {
    const [h, d] = nearest(me, hunters());
    comp.hidden = !h;
    if (h) {
      const ang = Math.atan2(h.y - me.y, h.x - me.x) + Math.PI / 2;
      $('#compArrow').setAttribute('transform', `rotate(${ang * 180 / Math.PI} 17 17)`);
      const band = d < 40 ? 'Sehr nah' : d < 90 ? 'Nah' : d < 180 ? 'Mittel' : 'Weit';
      $('#compTxt').innerHTML = `<span style="color:${d < 90 ? 'var(--hunt)' : 'inherit'}">${band}</span>${G.pass ? `<br><span style="color:var(--muted);font-weight:500">${Math.round(d / 10) * 10} m</span>` : ''}`;
      if (G.voice) {
        const now = performance.now();
        if (d < 60 && now - G.lastSay > 9000) { G.lastSay = now; say(`Jäger in ${Math.round(d / 10) * 10} Metern.`); }
        const iv = d < 25 ? 380 : d < 60 ? 650 : d < 100 ? 1000 : 0;
        if (iv && now > G.heartT) { G.heartT = now + iv; sfx.beat(d < 25 ? .55 : .35); }
      }
    }
  } else comp.hidden = true;
  $('#btnCatch').hidden = !catchable();
  const bt = $('#btnBetray'); if (bt) bt.disabled = G.betrayCd > 0 || G.t < G.head;
}
function loop(now) {
  if (!G.running) return;
  const dtReal = Math.min(.1, (now - G.last) / 1000); G.last = now;
  if (!G.paused) {
    let dt = dtReal * (G.gps ? 1 : SPEED_BASE) * G.speed;
    while (dt > 0 && G.running) { const d = Math.min(dt, 1); step(d); dt -= d; }
  }
  if (!G.running) return;
  drawGame(); updateHud();
  requestAnimationFrame(loop);
}

/* ---------- HUD controls ---------- */
$('#btnSpeed').onclick = () => { if (G.gps) { toast('Im echten Spiel läuft die Zeit normal.'); return; } G.speed = G.speed === 1 ? 2 : G.speed === 2 ? 4 : 1; $('#btnSpeed').textContent = '×' + G.speed; };
$('#btnCatch').onclick = () => { const t = catchable(); if (t) catchRunner(G.me, t); };
$('#btnCenter').onclick = () => { if (G.useMap && GM.map) { GM.map.easeTo({ center: lngLat(G.me), zoom: Math.max(GM.map.getZoom(), 17), duration: 500 }); } else toast('Die ganze Zone ist im Bild.'); };
$('#btnLeave').onclick = () => {
  G.paused = true;
  overlay(`<h3>Runde verlassen?</h3><p>Dein Standort wird ab sofort nicht mehr geteilt. Die anderen spielen ohne dich weiter.</p><button class="btn red" id="ovA">Verlassen</button><button class="btn ghost small" id="ovB">Weiterspielen</button>`,
    c => { c.querySelector('#ovA').onclick = () => { closeOverlay(); quitGame(); goHome(); }; c.querySelector('#ovB').onclick = () => { closeOverlay(); G.paused = false; }; });
};
(() => {
  const b = $('#btnSos'), fill = $('#sosFill'); let t0 = 0, raf = 0;
  const tick = () => { const p = clamp((performance.now() - t0) / 2000, 0, 1); fill.style.transform = `scaleX(${p})`; if (p >= 1) { cancel(); sos(); } else raf = requestAnimationFrame(tick); };
  const cancel = () => { cancelAnimationFrame(raf); t0 = 0; fill.style.transform = 'scaleX(0)'; };
  b.addEventListener('pointerdown', e => { e.preventDefault(); t0 = performance.now(); raf = requestAnimationFrame(tick); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, cancel));
  b.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !t0) { t0 = performance.now(); raf = requestAnimationFrame(tick); } });
  b.addEventListener('keyup', cancel);
})();
function sos() {
  G.paused = true; try { speechSynthesis.cancel(); } catch (e) {}
  tone(988, .3, 'square', .12); tone(988, .3, 'square', .12, .4);
  const contact = S.emergency ? esc(S.emergency) : 'kein Notfallkontakt hinterlegt';
  overlay(`<div class="tape"></div><h3>SOS ausgelöst</h3><p>Die Runde ist für alle gestoppt. Alle Mitspieler sehen jetzt deinen Standort. Dein Notfallkontakt (${contact}) wurde benachrichtigt.</p><p><b>Bei Lebensgefahr: Notruf 112</b></p><p class="demo-note">Demo: Es wurde nichts gesendet.</p><button class="btn ghost" id="ovA">Entwarnung, weiterspielen</button><button class="btn red" id="ovB">Runde für alle beenden</button>`,
    c => { c.querySelector('#ovA').onclick = () => { closeOverlay(); G.paused = false; toast('Entwarnung gesendet. Weiter geht’s.'); }; c.querySelector('#ovB').onclick = () => { closeOverlay(); endRound('sos'); }; });
}
function quitGame() { G.running = false; stopGps(); try { G.wake && G.wake.release(); } catch (e) {} $('#game').hidden = true; document.body.style.overflow = ''; try { speechSynthesis.cancel(); } catch (e) {} }

/* ---------- end ---------- */
function endRound(winner) {
  if (!G.running) return;
  G.result = winner; G.rec.push({ t: G.t, p: G.ents.map(e => [Math.round(e.x), Math.round(e.y), e.team === 'hunter' ? 1 : 0, e.caught ? 1 : 0]) });
  G.events.push({ t: G.t, type: 'end', winner });
  quitGame();
  const me = G.me;
  S.stats.rounds++; S.stats.meters += Math.round(me.meters);
  const meHunterSide = me.team === 'hunter' || me.traitor;
  if (me.team === 'runner' && !me.caught && winner === 'runners' && !me.traitor) S.stats.escapes++;
  save();
  const won = winner === 'sos' ? null : (winner === 'hunters') === meHunterSide;
  const rsAlive = G.ents.filter(e => e.team === 'runner' && !e.caught && !e.traitor).length;
  const head = winner === 'sos' ? 'Abgebrochen' : won ? 'Gewonnen' : 'Verloren';
  const sub = winner === 'sos' ? 'Die Runde wurde per SOS beendet.' : winner === 'hunters' ? (G.mode === 'infect' ? 'Alle wurden infiziert.' : 'Die Jäger haben alle Läufer gefangen.') : `${rsAlive} ${rsAlive === 1 ? 'Läufer ist' : 'Läufer sind'} entkommen.`;
  $('#endResult').innerHTML = `<span class="eyebrow">Runde vorbei · ${fmt(G.t)} gespielt</span><span class="big" style="color:${won === null ? 'var(--fg)' : won ? 'var(--run)' : 'var(--hunt)'}">${head}</span><p class="lead">${sub}</p>`;
  const tr = G.ents.find(e => e.traitor);
  $('#endReveal').innerHTML = tr ? `<div class="reveal"><span class="eyebrow">Der Verräter war</span><br><b>${esc(tr.me ? 'Du' : tr.name)}</b></div>` : '';
  const rows = G.ents.slice().sort((a, b) => b.catches - a.catches || a.team.localeCompare(b.team));
  $('#endTable').innerHTML = `<thead><tr><th>Spieler</th><th>Rolle</th><th>Status</th><th class="num">Catches</th><th class="num">km</th></tr></thead><tbody>` +
    rows.map(e => `<tr><td><span class="dot" style="display:inline-block;vertical-align:middle;margin-right:6px;background:${e.team === 'hunter' ? HUNT : e.color};color:${e.team === 'hunter' ? HUNT : e.color}"></span>${esc(e.name)}${e.me ? ' (du)' : ''}</td><td>${e.mrx ? 'Mister X' : e.traitor ? 'Verräter' : e.infected ? 'Infiziert' : e.team === 'hunter' ? 'Jäger' : 'Läufer'}</td><td>${e.team === 'hunter' ? '–' : e.caught ? 'Gefangen' : 'Entkommen'}</td><td class="num">${e.catches}</td><td class="num">${(e.meters / 1000).toFixed(1).replace('.', ',')}</td></tr>`).join('') + '</tbody>';
  stack.length = 0; show('scr-end', false);
}
$('#endHome').onclick = goHome;
$('#endAgain').onclick = () => { C.code = null; openLobby(); };
$('#endTrailer').onclick = () => { audio(); show('scr-trailer'); };
$('#endReport').onclick = () => {
  const others = G.ents.filter(e => !e.me);
  overlay(`<h3>Spieler melden</h3><label class="field" for="repWho">Wen?<select class="input" id="repWho">${others.map(e => `<option>${esc(e.name)}</option>`).join('')}</select></label>
  <label class="field" for="repWhy">Was ist passiert?<select class="input" id="repWhy"><option>Körperkontakt oder Gewalt</option><option>Belästigung oder Beleidigung</option><option>Gesperrte Bereiche betreten</option><option>Fake-GPS / Cheating</option><option>Gefilmt ohne Zustimmung</option><option>Etwas anderes</option></select></label>
  <button class="btn" id="ovA">Meldung senden</button><button class="btn ghost small" id="ovB">Abbrechen</button>`,
    c => { c.querySelector('#ovA').onclick = () => { closeOverlay(); toast('Meldung gesendet. Wir prüfen sie (Demo).'); }; c.querySelector('#ovB').onclick = closeOverlay; });
};

/* ---------- trailer ---------- */
let TR = { raf: 0, sound: true, layer: null };
onShow['scr-trailer'] = () => { playTrailer(); };
$('#trPlay').onclick = () => { audio(); playTrailer(); };
$('#trSound').onclick = () => { TR.sound = !TR.sound; $('#trSound').style.opacity = TR.sound ? 1 : .4; };
function playTrailer() {
  cancelAnimationFrame(TR.raf);
  const c = $('#trCanvas'), pass = G.pass, total = pass ? 20 : 10;
  $('#trNote').textContent = pass ? 'Volle Länge ohne Wasserzeichen, mit Musik. In der App kannst du ihn direkt als Video speichern oder teilen. Spieler ohne Film-Zustimmung erscheinen nur als Punkt.' : 'Free-Version: 10 Sekunden mit Wasserzeichen. Mit dem Pass bekommst du 20 Sekunden mit Musik und ohne Wasserzeichen.';
  const { ctx, W, H } = fitCanvas(c);
  const s = (W * .92) / (2 * R0), v = { cx: W / 2, cy: H * .47, s };
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const layer = document.createElement('canvas'); layer.width = W * dpr; layer.height = H * dpr;
  const lc = layer.getContext('2d'); lc.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (G.useMap) {
    lc.fillStyle = '#0b0c0f'; lc.fillRect(0, 0, W, H); lc.strokeStyle = 'rgba(255,255,255,.05)'; lc.lineWidth = 1;
    for (let gx = -R0 * 1.4; gx <= R0 * 1.4; gx += 40) { lc.beginPath(); lc.moveTo(v.cx + gx * s, 0); lc.lineTo(v.cx + gx * s, H); lc.stroke(); }
    for (let gy = -R0 * 2.4; gy <= R0 * 2.4; gy += 40) { lc.beginPath(); lc.moveTo(0, v.cy + gy * s); lc.lineTo(W, v.cy + gy * s); lc.stroke(); }
  } else drawWorld(lc, v, W, H, { labels: false, blockedLabels: false });
  drawZone(lc, v, W, H, R0);
  const rec = G.rec, evs = G.events, ents = G.ents, gEnd = G.t;
  const intro = 1.8, outro = 3, mid = total - intro - outro;
  const tr = ents.find(e => e.traitor);
  const t0 = performance.now(); let lastBeat = -1, firedEv = new Set();
  const capOf = e => e.type === 'ping' ? 'PING.' : e.type === 'catch' ? `${e.name.toUpperCase()} GEFANGEN` : e.type === 'tip' ? 'VERRATEN.' : e.type === 'hunt' ? 'DIE JAGD BEGINNT' : null;
  const endTitle = G.result === 'sos' ? 'ABGEBROCHEN' : G.result === 'hunters' ? 'JÄGER GEWINNEN' : 'LÄUFER ENTKOMMEN';
  function caption(text, alpha = 1, size = 64, y = H * .8) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = 'center'; ctx.font = `900 ${size}px "Geist", system-ui, sans-serif`;
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineJoin = 'round';
    const words = text.split(' '), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > W * .86 && cur) { lines.push(cur); cur = w; } else cur = t; }
    lines.push(cur);
    lines.forEach((l, i) => { const yy = y + (i - (lines.length - 1) / 2) * size * .95; ctx.strokeText(l, W / 2, yy); ctx.fillStyle = '#fff'; ctx.fillText(l, W / 2, yy); });
    ctx.restore();
  }
  function frameAt(gt) { let i = 0; while (i < rec.length - 1 && rec[i + 1].t <= gt) i++; return i; }
  function draw(now) {
    const el = (now - t0) / 1000;
    if ($('#scr-trailer').hidden) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    // music
    if (pass && TR.sound && AC) { const beat = Math.floor(el / .5); if (beat !== lastBeat && el < total - .5) { lastBeat = beat; kick(0, .4); if (beat % 2) noise(0, .04, .06); if (beat % 4 === 0) tone(55, .45, 'sawtooth', .07); } }
    if (el < intro) {
      const words = [`${Math.round(gEnd / 60)} MINUTEN.`, `${ents.length} SPIELER.`];
      const w = words[el < intro / 2 ? 0 : 1];
      caption(w, 1, 92, H * .5);
    } else if (el < intro + mid) {
      const p = (el - intro) / mid, gt = p * gEnd;
      const zoom = 1 + p * .12;
      ctx.save(); ctx.translate(W / 2, H * .47); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H * .47);
      ctx.drawImage(layer, 0, 0, W, H);
      const fi = frameAt(gt);
      // trails
      ents.forEach((e, k) => {
        const col = e.team === 'hunter' || (rec[fi] && rec[fi].p[k][2]) ? HUNT : e.color;
        ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.globalAlpha = .9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i <= fi; i++) { const q = rec[i].p[k], x = v.cx + q[0] * s, y = v.cy + q[1] * s; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke(); ctx.restore();
        const q = rec[fi].p[k], x = v.cx + q[0] * s, y = v.cy + q[1] * s;
        ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fillStyle = q[3] ? '#555' : col; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.stroke();
        if (e.film) { ctx.fillStyle = '#fff'; ctx.font = '700 12px "Geist Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(e.name.toUpperCase(), x, y - 12); }
      });
      // event fx
      let cap = null;
      for (const e of evs) {
        const age = gt - e.t;
        if (age < 0) continue;
        const realAge = age / gEnd * mid;
        if (realAge < 1 && capOf(e)) { cap = { t: capOf(e), a: realAge < .8 ? 1 : (1 - realAge) * 5 }; }
        if (e.type === 'ping' && realAge < .7) {
          const f = frameAt(e.t);
          ents.forEach((en, k) => { const q = rec[f].p[k]; if (q[2] || q[3]) return; const x = v.cx + q[0] * s, y = v.cy + q[1] * s; ctx.beginPath(); ctx.arc(x, y, 8 + realAge * 70, 0, 7); ctx.strokeStyle = `rgba(255,255,255,${1 - realAge / .7})`; ctx.lineWidth = 3; ctx.stroke(); });
        }
        if (e.type === 'catch' && realAge < .9) {
          const x = v.cx + e.x * s, y = v.cy + e.y * s;
          ctx.beginPath(); ctx.arc(x, y, 10 + realAge * 90, 0, 7); ctx.fillStyle = `rgba(255,79,62,${.5 * (1 - realAge / .9)})`; ctx.fill();
        }
        if (!firedEv.has(e) && realAge >= 0 && TR.sound && AC) { firedEv.add(e); if (e.type === 'ping') sfx.ping(); if (e.type === 'catch') sfx.catch(); }
      }
      ctx.restore();
      // timer
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(16, 16, 112, 34); ctx.fillStyle = TAPE; ctx.font = '700 20px "Geist Mono", monospace'; ctx.textAlign = 'left'; ctx.fillText(fmt(gEnd - gt), 26, 40);
      if (cap) caption(cap.t, clamp(cap.a, 0, 1), cap.t.length > 12 ? 54 : 78);
    } else {
      const k = el - intro - mid;
      ctx.drawImage(layer, 0, 0, W, H); ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fillRect(0, 0, W, H);
      caption(endTitle, clamp(k * 3, 0, 1), 74, H * .38);
      if (tr && k > .7) caption(`VERRÄTER: ${(tr.me ? 'DU' : tr.name).toUpperCase()}`, clamp((k - .7) * 3, 0, 1), 44, H * .52);
      if (k > 1.4) {
        ctx.save(); ctx.globalAlpha = clamp((k - 1.4) * 3, 0, 1);
        ctx.fillStyle = TAPE; ctx.fillRect(0, H * .66, W, 70);
        ctx.fillStyle = '#14161b'; ctx.font = '900 56px "Geist", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PINGED', W / 2, H * .66 + 54);
        ctx.restore();
      }
    }
    // watermark
    if (!pass) {
      ctx.save(); ctx.translate(W / 2, H * .93); ctx.rotate(-.04);
      ctx.fillStyle = 'rgba(243,212,51,.92)'; ctx.fillRect(-W, -16, W * 2, 32);
      ctx.fillStyle = '#14161b'; ctx.font = '900 20px "Geist", system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('MADE WITH PINGED · FREE VERSION · MADE WITH PINGED', 0, 7); ctx.restore();
    } else { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '900 18px "Geist", system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.fillText('PINGED', W - 16, 38); }
    if (el < total) TR.raf = requestAnimationFrame(draw);
  }
  TR.raf = requestAnimationFrame(draw);
}

/* ---------- pass ---------- */
onShow['scr-pass'] = () => {
  const owned = !!S.pass;
  $('#passBuyBox').hidden = owned; $('#passOwned').hidden = !owned;
  if (owned) $('#passOwnedTxt').textContent = `Gekauft am ${new Date(S.pass.at).toLocaleDateString('de-DE')}. Die Kaufbestätigung ging an deine E-Mail-Adresse (Demo). Dein Widerrufsrecht ist mit der sofortigen Freischaltung erloschen, wie beim Kauf bestätigt.`;
  $('#pbParentRow').hidden = !S.minor;
  $('#pbExec').checked = $('#pbLose').checked = $('#pbParent').checked = false; checkBuy();
};
function checkBuy() { $('#passBuy').disabled = !($('#pbExec').checked && $('#pbLose').checked && (!S.minor || $('#pbParent').checked)); }
['pbExec', 'pbLose', 'pbParent'].forEach(id => $('#' + id).onchange = checkBuy);
$('#passBuy').onclick = () => {
  overlay(`<span class="eyebrow">App Store · Demo</span><h3>PINGED Pass</h3><p>Einmaliger Kauf · 19,99 € · kein Abo</p><p class="demo-note">Demo: Es wird nichts abgebucht. In der echten App öffnet sich hier der Kaufdialog von Apple bzw. Google.</p><button class="btn" id="ovA">Kauf bestätigen</button><button class="btn ghost small" id="ovB">Abbrechen</button>`,
    c => {
      c.querySelector('#ovB').onclick = closeOverlay;
      c.querySelector('#ovA').onclick = () => {
        S.pass = { at: new Date().toISOString(), price: 19.99, execConsent: true, withdrawalWaived: true, parentConsent: S.minor ? true : null };
        storePurchase(S.pass.at); save(); closeOverlay(); sfx && audio() && sfx.loot();
        toast('Pass aktiv. Viel Spaß!'); onShow['scr-pass']();
      };
    });
};
$('#passRestore').onclick = () => {
  const p = purchaseStored();
  if (p) { S.pass = { at: p, price: 19.99, restored: true }; save(); toast('Kauf wiederhergestellt.'); onShow['scr-pass'](); }
  else toast('Kein Kauf gefunden.');
};

/* ---------- privacy center ---------- */
onShow['scr-privacy'] = () => {
  $('#privPerms').innerHTML = permRows('priv_') + `<p class="note">Erteilt am ${S.consents.at ? new Date(S.consents.at).toLocaleString('de-DE') : '–'}${S.minor ? ` · Einwilligung der Eltern (${esc(S.parent.mail)}) am ${S.parent.confirmedAt ? new Date(S.parent.confirmedAt).toLocaleDateString('de-DE') : '–'}` : ''}</p>`;
  PERMS.forEach(p => $('#priv_' + p.k).onchange = e => {
    S.consents[p.k] = e.target.checked; save(); renderData();
    toast(e.target.checked ? `${p.t}: erlaubt` : `${p.t}: widerrufen`);
  });
  renderData();
  $('#privDeleteConfirm').hidden = true; $('#privDelete').hidden = false;
};
function renderData() { $('#privData').value = JSON.stringify({ ...S, hinweis: 'Standortverläufe werden nach jeder Runde gelöscht und sind deshalb nicht enthalten.' }, null, 2); }
$('#privCopy').onclick = () => {
  const ta = $('#privData');
  try { navigator.clipboard.writeText(ta.value).then(() => toast('Kopiert.'), () => { ta.select(); toast('Text markiert, jetzt kopieren.'); }); }
  catch (e) { ta.select(); toast('Text markiert, jetzt kopieren.'); }
};
$('#privDelete').onclick = () => { $('#privDelete').hidden = true; $('#privDeleteConfirm').hidden = false; };
$('#privDeleteNo').onclick = () => { $('#privDelete').hidden = false; $('#privDeleteConfirm').hidden = true; };
$('#privDeleteYes').onclick = () => {
  S = fresh(); try { localStorage.removeItem(KEY); } catch (e) {}
  ['dob', 'parentMail', 'pName', 'pEmergency'].forEach(id => $('#' + id).value = '');
  ['cAgb', 'cDs', 'cSafe'].forEach(id => $('#' + id).checked = false);
  $('#ageGo').disabled = true; $('#parentGo').disabled = true; $('#profileGo').disabled = true;
  stack.length = 0; show('scr-welcome', false); toast('Konto gelöscht.');
};

/* ---------- legal ---------- */
const DOCS = [
  { k: 'agb', t: 'AGB' }, { k: 'datenschutz', t: 'Datenschutzerklärung' }, { k: 'impressum', t: 'Impressum' },
  { k: 'widerruf', t: 'Widerrufsbelehrung' }, { k: 'eltern', t: 'Einverständnis Eltern' },
  { k: 'sicherheit', t: 'Sicherheitsregeln' }, { k: 'community', t: 'Community-Richtlinien' }
];
onShow['scr-legal'] = () => {
  $('#legalMenu').innerHTML = DOCS.map(d => `<button data-doc="${d.k}"><span><b>${d.t}</b></span><span>→</span></button>`).join('');
};
function md(src) {
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[([^\]]+)\]/g, '<mark>[$1]</mark>');
  const out = []; let list = null, para = [];
  const flushP = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
  const flushL = () => { if (list) { out.push(`<${list.t}>` + list.items.map(i => '<li>' + inline(i) + '</li>').join('') + `</${list.t}>`); list = null; } };
  for (const raw of src.split('\n')) {
    const l = raw.trimEnd();
    let m;
    if (!l.trim()) { flushP(); flushL(); continue; }
    if ((m = l.match(/^(#{1,3}) (.*)/))) { flushP(); flushL(); const n = m[1].length; out.push(`<h${n}>${inline(m[2])}</h${n}>`); continue; }
    if ((m = l.match(/^- (.*)/))) { flushP(); if (!list || list.t !== 'ul') { flushL(); list = { t: 'ul', items: [] }; } list.items.push(m[1]); continue; }
    if ((m = l.match(/^\d+\. (.*)/))) { flushP(); if (!list || list.t !== 'ol') { flushL(); list = { t: 'ol', items: [] }; } list.items.push(m[1]); continue; }
    flushL(); para.push(l);
  }
  flushP(); flushL();
  return out.join('\n');
}
function openDoc(k) {
  const d = DOCS.find(x => x.k === k);
  $('#docTitle').textContent = d ? d.t : 'Dokument';
  $('#docBody').innerHTML = md(LEGAL[k] || 'Nicht gefunden.');
  if ($('#game').hidden) show('scr-doc');
}

/* ---------- boot ---------- */
function boot() {
  if (S.profile && S.consents.agb) goHome(); else { S = fresh(); show('scr-welcome', false); }
  requestAnimationFrame(miniLoop);
  loadMap().catch(() => {});
}
boot();
