'use strict';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const KEY = 'pinged.v1', BUYKEY = 'pinged.purchase';
const COLORS = ['#4fd88f', '#5cc8ff', '#c38bff', '#ff7ab6', '#ffb547', '#7ee0d6'];
const BOT_NAMES = ['Dominick', 'Noah', 'Cyrus', 'Lina', 'Mara', 'Jonas', 'Elif', 'Ben', 'Aylin', 'Theo', 'Sofia'];
const HUNT = '#ff4f3e', TAPE = '#f3d433', RUN = '#4fd88f';

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

/* ---------- world ---------- */
const R0 = 320;
function makeWorld(seed = 11) {
  const r = rng(seed), step = 78, street = 15, blocks = [];
  for (let gx = -5; gx <= 4; gx++) for (let gy = -5; gy <= 4; gy++) {
    const x = gx * step + street / 2, y = gy * step + street / 2, w = step - street, h = step - street;
    const park = (gx === -1 && gy === 0) || (gx === 0 && gy === 0) || r() < .07;
    const b = { x, y, w, h, park, bld: [] };
    if (!park) {
      const split = r() < .5;
      if (split) { const k = .35 + r() * .3; b.bld.push([x + 3, y + 3, w * k - 5, h - 6], [x + w * k + 2, y + 3, w * (1 - k) - 5, h - 6]); }
      else { const k = .35 + r() * .3; b.bld.push([x + 3, y + 3, w - 6, h * k - 5], [x + 3, y + h * k + 2, w - 6, h * (1 - k) - 5]); }
    }
    blocks.push(b);
  }
  const blocked = [
    { x: 105, y: -290, w: 200, h: 95, name: 'Bahngelände' },
    { x: -300, y: 168, w: 230, h: 30, name: 'Kanal' },
    { x: -160, y: -150, w: 60, h: 55, name: 'Baustelle' },
    { x: 165, y: 90, w: 150, h: 26, name: 'Schnellstraße' }
  ];
  const labels = [
    { x: -8, y: -230, t: 'TARASTR.', rot: -Math.PI / 2 },
    { x: -200, y: -86, t: 'REBECCA-ALLEE', rot: 0 },
    { x: 150, y: 226, t: 'AM MARKT', rot: 0 }
  ];
  return { blocks, blocked, labels };
}
const WORLD = makeWorld();
function inBlocked(p, m = 2) { return WORLD.blocked.find(b => p.x > b.x - m && p.x < b.x + b.w + m && p.y > b.y - m && p.y < b.y + b.h + m); }

function hatch(ctx, x, y, w, h, color, gap = 7) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = 'rgba(255,79,62,.12)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.globalAlpha = .7; ctx.beginPath();
  for (let i = -h; i < w; i += gap) { ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); }
  ctx.stroke(); ctx.restore();
  ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.strokeRect(x, y, w, h);
}
/* draws the static map into ctx; view = {cx, cy, s} */
function drawWorld(ctx, v, W, H, opts = {}) {
  ctx.fillStyle = '#2b2f38'; ctx.fillRect(0, 0, W, H);
  const T = (x, y) => [v.cx + x * v.s, v.cy + y * v.s];
  for (const b of WORLD.blocks) {
    const [x, y] = T(b.x, b.y);
    ctx.fillStyle = b.park ? '#1d2c25' : '#1a1d23';
    ctx.fillRect(x, y, b.w * v.s, b.h * v.s);
    if (b.park) {
      ctx.fillStyle = '#244232';
      for (let i = 0; i < 5; i++) { const px = x + (b.w * v.s) * ((i * 37 % 100) / 100), py = y + (b.h * v.s) * ((i * 61 % 100) / 100); ctx.beginPath(); ctx.arc(px, py, Math.max(1.5, 4 * v.s), 0, 7); ctx.fill(); }
    }
    ctx.fillStyle = '#23272f';
    for (const r of b.bld) { const [bx, by] = T(r[0], r[1]); ctx.fillRect(bx, by, r[2] * v.s, r[3] * v.s); }
  }
  if (opts.labels !== false && v.s > .55) {
    ctx.fillStyle = 'rgba(236,235,230,.32)'; ctx.font = `600 ${Math.round(9 * Math.min(1.4, v.s))}px "JetBrains Mono", monospace`; ctx.textAlign = 'center';
    for (const l of WORLD.labels) { const [x, y] = T(l.x, l.y); ctx.save(); ctx.translate(x, y); ctx.rotate(l.rot); ctx.fillText(l.t, 0, 3); ctx.restore(); }
  }
  for (const b of WORLD.blocked) {
    const [x, y] = T(b.x, b.y); hatch(ctx, x, y, b.w * v.s, b.h * v.s, HUNT);
    if (opts.blockedLabels !== false) {
      ctx.fillStyle = '#ffb3aa'; ctx.font = `700 ${Math.round(Math.max(8, 9 * Math.min(1.3, v.s)))}px "JetBrains Mono", monospace`; ctx.textAlign = 'center';
      ctx.fillText(b.name.toUpperCase(), x + b.w * v.s / 2, y + b.h * v.s / 2 + 3);
    }
  }
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
  dots.forEach((d, i) => {
    const x = v.cx + (d.x + Math.sin(t / 1600 + d.ph) * 30) * v.s, y = v.cy + (d.y + Math.cos(t / 1900 + d.ph) * 30) * v.s;
    const pulse = ((t / 1000 + d.ph) % 2.4) / 2.4;
    if (i > 0) { ctx.beginPath(); ctx.arc(x, y, 6 + pulse * 22, 0, 7); ctx.strokeStyle = `rgba(79,216,143,${1 - pulse})`; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(x, y, i === 0 ? 7 : 8, 0, 7); ctx.fillStyle = i === 0 ? HUNT : 'rgba(79,216,143,.85)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#0f1115'; ctx.stroke();
    ctx.fillStyle = '#ecebe6'; ctx.font = '700 10px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText(i === 0 ? 'DU' : BOT_NAMES[i].toUpperCase(), x, y - 14);
    if (i > 0) { ctx.fillStyle = 'rgba(236,235,230,.6)'; ctx.font = '500 9px "JetBrains Mono", monospace'; ctx.fillText('LIVE PING', x, y + 22); }
  });
}
function drawZonePreview() {
  const c = $('#zoneCanvas'); const { ctx, W, H } = fitCanvas(c);
  const v = { cx: W / 2, cy: H / 2, s: Math.min(W, H) / (2 * R0 * 1.08) };
  drawWorld(ctx, v, W, H); drawZone(ctx, v, W, H, R0);
  ctx.beginPath(); ctx.arc(v.cx, v.cy, 9, 0, 7); ctx.fillStyle = TAPE; ctx.fill();
  ctx.fillStyle = '#ecebe6'; ctx.font = '700 11px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('START', v.cx, v.cy - 16);
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
  $('#permList').innerHTML = '<span class="eyebrow">Berechtigungen</span>' + permRows('perm_') + '<p class="note">Dein Handy fragt danach noch einmal selbst nach. Du kannst alles jederzeit im Datenschutz-Center ändern.</p>';
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
  $('#homeName').textContent = S.profile.name; $('#homeDot').style.background = S.profile.color; $('#homeDot').style.color = S.profile.color;
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
  $('#modes').innerHTML = MODES.map(m => `<button class="mode" aria-pressed="${C.mode === m.k}" data-k="${m.k}"${m.soon ? ' disabled' : ''}>${m.pass && !P ? '<span class="lock">PASS</span>' : ''}${m.soon ? '<span class="lock">BALD</span>' : ''}<b>${m.t}</b><small>${m.d}</small></button>`).join('');
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
  show('scr-lobby');
  $('#rcLoc').checked = false; $('#rcFilm').checked = S.consents.cam;
  const pend = C.roster.filter(p => p.pending);
  pend.forEach((p, i) => lobbyTimers.push(setTimeout(() => { p.pending = false; p.ready = true; renderLobby(); }, 500 + i * 380)));
  renderLobby();
}
function renderLobby() {
  const m = MODES.find(x => x.k === C.mode);
  $('#lobbyCode').textContent = C.code;
  $('#lobbyMeta').textContent = `${m.t} · ${C.dur} min · Ping alle ${C.ping} min · Host: ${C.host}${C.hostPass ? ' (Pass)' : ''}`;
  $('#rcN').textContent = C.roster.length - 1;
  $('#lobbyPlayers').innerHTML = C.roster.map(p => `<div class="pl"><span class="dot" style="background:${p.color};color:${p.color}"></span><span class="n">${esc(p.name)}${p.me ? ' (du)' : ''}${p.host ? ' · Host' : ''}</span>${p.pending ? '<span class="wait">TRITT BEI …</span>' : p.me ? (p.ready ? '<span class="ok">BEREIT ✓</span>' : '<span class="wait">ZUSTIMMUNG FEHLT</span>') : '<span class="ok">ZUGESTIMMT ✓</span>'}</div>`).join('');
  const all = C.roster.every(p => !p.pending);
  const me = C.roster.find(p => p.me); me.ready = $('#rcLoc').checked;
  const b = $('#lobbyGo');
  b.disabled = !(all && me.ready);
  b.textContent = !all ? 'Warte auf Spieler …' : !me.ready ? 'Erst zustimmen' : C.joined ? 'Bereit' : 'Runde starten';
}
$('#rcLoc').onchange = renderLobby;
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
    zoneR: R0, started: performance.now(), view: null
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
  card.innerHTML = `<span class="eyebrow">Deine Rolle · ${MODES.find(m => m.k === G.mode).t}</span><span class="big">${info.t}</span><p>${info.d}</p><p class="note">${r === 'hunter' ? `Die Läufer haben ${C.head} Minuten Vorsprung. Du wartest am Start.` : `Du hast ${C.head} Minuten Vorsprung. Tippe auf die Karte, um dorthin zu laufen.`}</p>`;
  card.classList.remove('show'); void card.offsetWidth; card.classList.add('show');
  show('scr-role');
  if (G.voice) say(`Du bist ${info.t}.`);
}
$('#roleGo').onclick = () => { audio(); beginGame(); };

function beginGame() {
  $('#game').hidden = false; document.body.style.overflow = 'hidden';
  G.running = true; G.last = performance.now();
  const m = MODES.find(x => x.k === G.mode);
  $('#hudMode').textContent = m.t.toUpperCase();
  setBanner(roleOf(G.me) === 'hunter' ? 'Vorsprung läuft' : 'Lauf!', roleOf(G.me) === 'hunter' ? '' : 'green');
  say(roleOf(G.me) === 'hunter' ? `Runde gestartet. Die Läufer haben ${C.head} Minuten Vorsprung.` : `Runde gestartet. Du hast ${C.head} Minuten Vorsprung. Lauf.`);
  sfx.ping();
  resizeGame(); renderItems();
  requestAnimationFrame(loop);
}
function setBanner(text, kind = '') {
  const b = $('#hudBanner'); b.textContent = text; b.className = 'hud-banner anim ' + kind; b.hidden = false;
  void b.offsetWidth; G.bannerUntil = performance.now() + 2600;
}

/* ---------- game view ---------- */
const GC = $('#gameCanvas');
let worldLayer = null;
function resizeGame() {
  const { W, H } = fitCanvas(GC);
  const top = 150, bottom = 190, avail = Math.max(180, Math.min(W - 16, H - top - bottom));
  const s = avail / (2 * R0);
  G.view = { cx: W / 2, cy: top + (H - top - bottom) / 2, s, W, H };
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  worldLayer = document.createElement('canvas'); worldLayer.width = W * dpr; worldLayer.height = H * dpr;
  const wc = worldLayer.getContext('2d'); wc.setTransform(dpr, 0, 0, dpr, 0, 0); drawWorld(wc, G.view, W, H);
}
window.addEventListener('resize', () => { if (G.running) resizeGame(); });
function toWorld(px, py) { const v = G.view; return { x: (px - v.cx) / v.s, y: (py - v.cy) / v.s }; }
GC.addEventListener('pointerdown', e => {
  if (!G.running || G.paused) return;
  const me = G.me; if (me.caught && G.mode !== 'infect') return;
  if (me.team === 'hunter' && G.t < G.head) { toast('Warte, bis der Vorsprung vorbei ist.'); return; }
  const r = GC.getBoundingClientRect(), p = toWorld(e.clientX - r.left, e.clientY - r.top);
  const b = inBlocked(p);
  if (b) { toast(b.name + ' ist gesperrt.'); return; }
  me.tx = p.x; me.ty = p.y;
});

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
  if (me.team === 'hunter' || me.traitor) { setBanner('Ping detected'); sfx.ping(); say(n === 1 ? 'Ping. Ein Läufer geortet.' : `Ping. ${n} Läufer geortet.`); }
  else if (!me.caught) { setBanner(me.mrx ? 'Umkreis gesendet' : 'Du wurdest gepingt', 'red'); sfx.pinged(); say('Du wurdest gepingt. Bleib in Bewegung.'); }
  else { setBanner('Ping detected'); sfx.ping(); }
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
  html += `<button class="catch" id="btnCatch" hidden>FANGEN</button>`;
  if ((me.caught && G.mode !== 'infect')) html += `<button id="btnSkip">Vorspulen ×8</button>`;
  box.innerHTML = html;
  box.querySelectorAll('[data-i]').forEach(b => b.onclick = () => useItem(+b.dataset.i));
  const bt = $('#btnBetray'); if (bt) bt.onclick = () => {
    const victims = activeRunners().filter(r => r !== me); const [v] = nearest(me, victims);
    if (v) { leak(v, true); G.betrayCd = G.ping; renderItems(); }
  };
  const bc = $('#btnCatch'); bc.onclick = () => { const t = catchable(); if (t) { catchRunner(me, t); } };
  const sk = $('#btnSkip'); if (sk) sk.onclick = () => { G.speed = 8; $('#btnSpeed').textContent = 'Tempo ×8'; };
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
function drawGame() {
  const v = G.view, { W, H } = v, ctx = GC.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(worldLayer, 0, 0, W, H);
  drawZone(ctx, v, W, H, G.zoneR);
  const T = p => [v.cx + p.x * v.s, v.cy + p.y * v.s];
  const me = G.me, now = performance.now();
  // start marker
  { const [x, y] = T({ x: 0, y: 0 }); ctx.strokeStyle = 'rgba(243,212,51,.5)'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 5, y - 5, 10, 10); }
  // crates
  for (const c of G.crates) { const [x, y] = T(c); ctx.fillStyle = TAPE; ctx.fillRect(x - 6, y - 6, 12, 12); ctx.fillStyle = '#1a1700'; ctx.font = '700 10px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('?', x, y + 4); }
  // markers (only for hunter-side viewers)
  const hunterView = me.team === 'hunter' || me.traitor || (me.caught && G.mode !== 'infect');
  if (hunterView) for (const m of G.markers) {
    const age = G.t - m.t; if (age > G.ping * 1.3) continue;
    const a = clamp(1 - age / (G.ping * 1.3), .25, 1), [x, y] = T(m);
    const col = m.kind === 'tip' ? TAPE : m.kind === 'out' ? HUNT : RUN;
    if (m.fuzzy) { ctx.beginPath(); ctx.arc(x, y, 60 * v.s, 0, 7); ctx.fillStyle = `rgba(79,216,143,${.15 * a})`; ctx.fill(); ctx.strokeStyle = `rgba(79,216,143,${.6 * a})`; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]); }
    const pulse = ((now / 1000) % 1.6) / 1.6;
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(x, y, 10 + pulse * 18, 0, 7); ctx.strokeStyle = col; ctx.globalAlpha = a * (1 - pulse); ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.fillStyle = col; ctx.fill();
    ctx.fillStyle = '#ecebe6'; ctx.font = '700 10px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText(m.name.toUpperCase(), x, y - 16);
    ctx.fillStyle = 'rgba(236,235,230,.75)'; ctx.font = '500 9px "JetBrains Mono", monospace';
    const lbl = m.kind === 'tip' ? 'TIPP' : m.kind === 'out' ? 'AUSSERHALB' : 'LIVE PING';
    ctx.fillText(`${lbl} · ${age < 30 ? 'jetzt' : 'vor ' + Math.max(1, Math.round(age / 60)) + ' min'}`, x, y + 22);
    ctx.globalAlpha = 1;
  }
  // my target line
  if (me.tx != null) { const [a, b] = T(me), [c, d] = T({ x: me.tx, y: me.ty }); ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(236,235,230,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(c, d, 4, 0, 7); ctx.fillStyle = 'rgba(236,235,230,.7)'; ctx.fill(); }
  // entities
  for (const e of G.ents) {
    if (!visibleTo(me, e)) continue;
    const [x, y] = T(e);
    if (e.caught) { ctx.globalAlpha = .35; }
    const col = e.team === 'hunter' ? HUNT : e.color;
    if (e === me) { ctx.beginPath(); ctx.arc(x, y, 15, 0, 7); ctx.fillStyle = 'rgba(236,235,230,.12)'; ctx.fill(); }
    ctx.beginPath(); ctx.arc(x, y, e === me ? 8 : 6.5, 0, 7); ctx.fillStyle = col; ctx.fill();
    ctx.lineWidth = e === me ? 3 : 2; ctx.strokeStyle = e === me ? '#ecebe6' : '#0f1115'; ctx.stroke();
    ctx.fillStyle = '#ecebe6'; ctx.font = '700 10px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    let tag = e === me ? 'DU' : e.name.toUpperCase();
    if ((me.traitor || (me.caught && G.mode !== 'infect')) && e.traitor && e !== me) tag += ' · V';
    ctx.fillText(tag + (e.caught ? ' ✕' : ''), x, y - 13);
    ctx.globalAlpha = 1;
  }
  // scan/drone tint
  if (G.effects.scan > 0 || G.effects.drone > 0) { ctx.fillStyle = 'rgba(243,212,51,.05)'; ctx.fillRect(0, 0, W, H); }
}
function updateHud() {
  const me = G.me;
  const r = me.caught && G.mode !== 'infect' ? 'ZUSCHAUER' : me.team === 'hunter' ? (me.infected ? 'INFIZIERT' : 'JÄGER') : me.mrx ? 'MISTER X' : me.traitor ? 'VERRÄTER' : 'LÄUFER';
  const role = $('#hudRole'); role.textContent = r; role.style.color = me.team === 'hunter' ? HUNT : me.traitor ? TAPE : r === 'ZUSCHAUER' ? '#9097a5' : RUN;
  $('#hudClock').textContent = fmt(G.dur - G.t);
  if (G.t < G.head) { $('#hudNextLbl').textContent = 'JAGD STARTET IN'; $('#hudNext').textContent = fmt(G.head - G.t); }
  else { $('#hudNextLbl').textContent = 'NÄCHSTER PING'; $('#hudNext').textContent = fmt(G.nextPing - G.t); }
  const rs = G.ents.filter(e => e.team === 'runner'), alive = rs.filter(e => !e.caught).length;
  let info = `Läufer ${alive}/${rs.length} · Jäger ${G.ents.filter(e => e.team === 'hunter').length}`;
  if (G.mode === 'zone' && G.t > G.head) info += ` · Zone ${Math.round(G.zoneR)} m`;
  if (G.effects.scan > 0) info += ` · Scan ${Math.ceil(G.effects.scan)} s`;
  if (G.effects.drone > 0) info += ` · Drohne ${Math.ceil(G.effects.drone)} s`;
  if (me.team === 'runner' && !me.caught && me.outT > 0) info = `<b style="color:var(--hunt)">AUSSERHALB DER ZONE · live sichtbar in ${Math.max(0, Math.ceil(30 - me.outT))} s</b>`;
  $('#hudInfo').innerHTML = info;
  if (performance.now() > (G.bannerUntil || 0)) $('#hudBanner').hidden = true;
  // compass for runners
  const comp = $('#hudCompass');
  if (me.team === 'runner' && !me.caught && G.t >= G.head) {
    const [h, d] = nearest(me, hunters());
    comp.hidden = !h;
    if (h) {
      const ang = Math.atan2(h.y - me.y, h.x - me.x) + Math.PI / 2;
      $('#compArrow').setAttribute('transform', `rotate(${ang * 180 / Math.PI} 17 17)`);
      const band = d < 40 ? 'SEHR NAH' : d < 90 ? 'NAH' : d < 180 ? 'MITTEL' : 'WEIT';
      $('#compTxt').innerHTML = `Nächster Jäger: <b style="color:${d < 90 ? 'var(--hunt)' : 'inherit'}">${band}</b>${G.pass ? ` · ${Math.round(d / 10) * 10} m` : ''}`;
      // voice + heartbeat (pass)
      if (G.voice) {
        const now = performance.now();
        if (d < 60 && now - G.lastSay > 9000) { G.lastSay = now; say(`Jäger in ${Math.round(d / 10) * 10} Metern.`); }
        const iv = d < 25 ? 380 : d < 60 ? 650 : d < 100 ? 1000 : 0;
        if (iv && now > G.heartT) { G.heartT = now + iv; sfx.beat(d < 25 ? .55 : .35); }
      }
    }
  } else comp.hidden = true;
  const bc = $('#btnCatch'); if (bc) bc.hidden = !catchable();
  const bt = $('#btnBetray'); if (bt) bt.disabled = G.betrayCd > 0 || G.t < G.head;
}
function loop(now) {
  if (!G.running) return;
  const dtReal = Math.min(.1, (now - G.last) / 1000); G.last = now;
  if (!G.paused) {
    let dt = dtReal * SPEED_BASE * G.speed;
    while (dt > 0 && G.running) { const d = Math.min(dt, 1); step(d); dt -= d; }
  }
  if (!G.running) return;
  drawGame(); updateHud();
  requestAnimationFrame(loop);
}

/* ---------- HUD controls ---------- */
$('#btnSpeed').onclick = () => { G.speed = G.speed === 1 ? 2 : G.speed === 2 ? 4 : 1; $('#btnSpeed').textContent = 'Tempo ×' + G.speed; };
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
function quitGame() { G.running = false; $('#game').hidden = true; document.body.style.overflow = ''; try { speechSynthesis.cancel(); } catch (e) {} }

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
  const lc = layer.getContext('2d'); lc.setTransform(dpr, 0, 0, dpr, 0, 0); drawWorld(lc, v, W, H, { labels: false, blockedLabels: false });
  drawZone(lc, v, W, H, R0);
  const rec = G.rec, evs = G.events, ents = G.ents, gEnd = G.t;
  const intro = 1.8, outro = 3, mid = total - intro - outro;
  const tr = ents.find(e => e.traitor);
  const t0 = performance.now(); let lastBeat = -1, firedEv = new Set();
  const capOf = e => e.type === 'ping' ? 'PING.' : e.type === 'catch' ? `${e.name.toUpperCase()} GEFANGEN` : e.type === 'tip' ? 'VERRATEN.' : e.type === 'hunt' ? 'DIE JAGD BEGINNT' : null;
  const endTitle = G.result === 'sos' ? 'ABGEBROCHEN' : G.result === 'hunters' ? 'JÄGER GEWINNEN' : 'LÄUFER ENTKOMMEN';
  function caption(text, alpha = 1, size = 64, y = H * .8) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = 'center'; ctx.font = `900 ${size}px "Big Shoulders Display", Impact, sans-serif`;
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
        if (e.film) { ctx.fillStyle = '#fff'; ctx.font = '700 12px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(e.name.toUpperCase(), x, y - 12); }
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
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(16, 16, 112, 34); ctx.fillStyle = TAPE; ctx.font = '700 20px "JetBrains Mono", monospace'; ctx.textAlign = 'left'; ctx.fillText(fmt(gEnd - gt), 26, 40);
      if (cap) caption(cap.t, clamp(cap.a, 0, 1), cap.t.length > 12 ? 54 : 78);
    } else {
      const k = el - intro - mid;
      ctx.drawImage(layer, 0, 0, W, H); ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fillRect(0, 0, W, H);
      caption(endTitle, clamp(k * 3, 0, 1), 74, H * .38);
      if (tr && k > .7) caption(`VERRÄTER: ${(tr.me ? 'DU' : tr.name).toUpperCase()}`, clamp((k - .7) * 3, 0, 1), 44, H * .52);
      if (k > 1.4) {
        ctx.save(); ctx.globalAlpha = clamp((k - 1.4) * 3, 0, 1);
        ctx.fillStyle = TAPE; ctx.fillRect(0, H * .66, W, 70);
        ctx.fillStyle = '#14161b'; ctx.font = '900 56px "Big Shoulders Display", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PINGED', W / 2, H * .66 + 54);
        ctx.restore();
      }
    }
    // watermark
    if (!pass) {
      ctx.save(); ctx.translate(W / 2, H * .93); ctx.rotate(-.04);
      ctx.fillStyle = 'rgba(243,212,51,.92)'; ctx.fillRect(-W, -16, W * 2, 32);
      ctx.fillStyle = '#14161b'; ctx.font = '900 20px "Big Shoulders Display", Impact, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('MADE WITH PINGED · FREE VERSION · MADE WITH PINGED', 0, 7); ctx.restore();
    } else { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '900 18px "Big Shoulders Display", Impact, sans-serif'; ctx.textAlign = 'right'; ctx.fillText('PINGED', W - 16, 38); }
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
  $('#privPerms').innerHTML = '<span class="eyebrow">Einwilligungen</span>' + permRows('priv_') + `<p class="note">Erteilt am ${S.consents.at ? new Date(S.consents.at).toLocaleString('de-DE') : '–'}${S.minor ? ` · Einwilligung der Eltern (${esc(S.parent.mail)}) am ${S.parent.confirmedAt ? new Date(S.parent.confirmedAt).toLocaleDateString('de-DE') : '–'}` : ''}</p>`;
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
}
boot();
