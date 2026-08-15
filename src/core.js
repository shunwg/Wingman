/* ============================================================
   WINGMAN — app core: store, simulated clock, split-flap,
   avatars, router scaffold, tick loop
   ============================================================ */

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- simulated clock (deterministic demo evening) ---------- */
const SIM_START_SEC = toMin('21:32') * 60;
const REAL_START = Date.now();
const simSec = () => SIM_START_SEC + Math.floor((Date.now() - REAL_START) / 1000);
const simMin = () => simSec() / 60;
const simHM = () => fromMin(Math.floor(simMin()));
const simHMS = () => {
  const s = simSec();
  return fromMin(Math.floor(s / 60)) + ':' + String(s % 60).padStart(2, '0');
};

/* ---------- persistent store (localStorage, hydrated safely) ---------- */
const K = 'wingman_v1';
const blankState = () => ({
  trip: null,          // { dir, flightNo, timeMin, timeLabel, originCity, originIata, areaId, areaLabel, spot, flex, mode, vibes, open, visibleTo, gender, name, createdHM }
  verify: null,        // { method: 'bankid'|'linkedin'|'instagram'|'facebook', atHM } — survives new trips
  m: {},               // per-traveller match state machine
  passed: [],          // "Different route"
  boardPlayed: false,  // 10-second choreography shown once per trip
  log: [],             // trip timeline events
  replyIdx: 0,
});
let S = blankState();
try {
  const raw = localStorage.getItem(K);
  if (raw) S = Object.assign(blankState(), JSON.parse(raw));
} catch (e) { /* private mode etc. — run in-memory */ }
const save = () => { try { localStorage.setItem(K, JSON.stringify(S)); } catch (e) {} };
const logEvent = txt => { S.log.push({ t: simHM(), txt }); save(); };
const resetDemo = () => { S = blankState(); save(); location.hash = '#/'; render(); };

/* match states: joined → cleared → gate_user → boarding · or ended */
const mState = id => S.m[id]?.st || 'none';

/* ---------- split-flap text (word-wrapping, staggered flips) ---------- */
function flapMarkup(text, prev) {
  let i = 0; // running char index across the whole string (spaces included)
  return String(text).split(' ').map(w => {
    const chars = [...w].map(c => {
      const changed = prev !== null && prev !== undefined && prev[i] !== c;
      const d = i * 26; i++;
      return `<span${changed && !RM ? ` class="flip" style="animation-delay:${d}ms"` : ''}>${esc(c)}</span>`;
    }).join('');
    i++; // the space
    return `<i class="w">${chars}</i>`;
  }).join('');
}
function flapHTML(text, cls = '') {
  return `<div class="flap ${cls}" data-txt="${esc(text)}">${flapMarkup(text, null)}</div>`;
}
/* Animate an existing .flap element to new text — changed tiles flip in sequence */
function flapTo(el, text) {
  if (!el) return;
  const prev = el.dataset.txt ?? '';
  if (prev === text) return;
  el.dataset.txt = text;
  el.innerHTML = flapMarkup(text, prev);
}

/* ---------- avatars: silhouette until Cleared, monogram after ---------- */
function avatarSVG(t, revealed) {
  const hue = t.hue ?? 40;
  if (!revealed) {
    return `<svg viewBox="0 0 46 46" role="img" aria-label="Anonymous traveller">
      <rect width="46" height="46" fill="hsl(${hue} 22% 16%)"/>
      <circle cx="23" cy="18" r="8" fill="hsl(${hue} 18% 34%)"/>
      <path d="M8 44 a15 13 0 0 1 30 0z" fill="hsl(${hue} 18% 34%)"/>
    </svg>`;
  }
  return `<svg viewBox="0 0 46 46" role="img" aria-label="${esc(t.name)}">
    <rect width="46" height="46" fill="hsl(${hue} 55% 26%)"/>
    <circle cx="34" cy="10" r="14" fill="hsl(${hue} 65% 38%)" opacity=".55"/>
    <text x="23" y="30" text-anchor="middle" font-family="JetBrains Mono, monospace"
      font-size="19" font-weight="700" fill="#F4EFE6">${esc(t.name[0])}</text>
  </svg>`;
}

/* Public identity per privacy ladder */
function publicName(t) {
  const st = mState(t.id);
  const revealed = st === 'cleared' || st === 'gate_user' || st === 'boarding';
  return revealed ? t.name : 'Traveller on ' + t.flight;
}
function isRevealed(t) {
  const st = mState(t.id);
  return st === 'cleared' || st === 'gate_user' || st === 'boarding';
}

/* ---------- helpers over data ---------- */
const flightByNo = no => FLIGHTS.find(f => f.no === no);
const areaById = id => AREAS.find(a => a.id === id);
const travellerById = id => TRAVELLERS.find(t => t.id === id);

/* trip + live verification status, as the matching engine expects it */
function effTrip() {
  return S.trip ? { ...S.trip, verified: !!S.verify } : null;
}
function currentMatches() {
  if (!S.trip) return [];
  return computeMatches(effTrip(), TRAVELLERS, FLIGHTS, FARES)
    .filter(r => !S.passed.includes(r.t.id) && mState(r.t.id) !== 'ended');
}
function matchFor(id) {
  if (!S.trip) return null;
  return computeMatches(effTrip(), TRAVELLERS, FLIGHTS, FARES).find(r => r.t.id === id) || null;
}

/* ---------- verification + per-person privacy helpers ---------- */
const VERIFY_LABEL = { bankid: 'BankID', linkedin: 'LinkedIn', instagram: 'Instagram', facebook: 'Facebook' };
const VIS_LABEL = {
  everyone: 'Visible to everyone', verified: 'Visible to verified travellers only',
  women: 'Visible to women only', men: 'Visible to men only',
};
function verifyChip(t, dark = false) {
  return `<span class="vchip ${dark ? 'dark' : ''}">✓ ${VERIFY_LABEL[t.verify] || 'Verified'}</span>`;
}

/* ---------- distance ruler: metres from your drop-off, of the 1 km rule ---------- */
function rulerHTML(distM, paper = false) {
  const pct = Math.min(100, distM / 10).toFixed(1);
  return `<div class="ruler ${paper ? 'paper' : ''}" role="img"
      aria-label="${distM} metres between drop-offs, of 1000 allowed">
    <span class="rlab">0</span>
    <div class="rtrack"><i style="left:${pct}%"></i></div>
    <span class="rlab">1 KM</span>
    <b class="rval">${distM} M</b>
  </div>`;
}

/* ---------- deterministic barcode per traveller (pure decoration, IATA feel) ---------- */
function barcodeSVG(seed, w = 104, h = 20) {
  let hsh = 0;
  for (const c of String(seed)) hsh = (hsh * 31 + c.charCodeAt(0)) >>> 0;
  const rng = () => ((hsh = (hsh * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  let x = 0, bars = '';
  while (x < w - 2) {
    const bw = 1 + Math.floor(rng() * 2.6);
    bars += `<rect x="${x}" y="0" width="${bw}" height="${h}"/>`;
    x += bw + 1 + Math.floor(rng() * 2.2);
  }
  return `<svg class="barcode" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${bars}</svg>`;
}
function wheelsDownLeftMin() {
  if (!S.trip) return 0;
  return Math.max(0, Math.round(S.trip.timeMin - simMin()));
}

/* ---------- route receipt ---------- */
function receiptHTML(r, dark = false) {
  const you = esc((S.trip?.name || 'You').toUpperCase());
  const them = esc((isRevealed(r.t) ? r.t.name : 'TRAVELLER').toUpperCase());
  const dirWord = S.trip.dir === 'arriving' ? 'Landing gap' : 'Departure gap';
  const apart = S.trip.dir === 'arriving' ? 'Drop-offs apart' : 'Pick-ups apart';
  const vibeRow = r.vibes.length
    ? `<div class="rrow"><b>Both chose “${esc(r.vibes[0])}${r.vibes.length > 1 ? ' +' + (r.vibes.length - 1) : ''}”</b><span class="ok">✓</span></div>`
    : `<div class="rrow"><b>Vibe overlap</b><span>NONE — STILL FINE</span></div>`;
  const fareRow = r.fare.mode === 'train'
    ? `<div class="rrow"><b>Flytoget together</b><span>${r.fare.each} KR EACH</span></div>`
    : `<div class="rrow"><b>Estimated saving</b><span class="ok">${r.fare.saving} KR EACH</span></div>`;
  const idRow = `<div class="rrow"><b>ID check</b><span class="${S.verify ? 'ok' : ''}">${(VERIFY_LABEL[r.t.verify] || '').toUpperCase()} ✓ · YOU ${S.verify ? '✓' : '—'}</span></div>`;
  return `<div class="receipt ${dark ? 'on-dark' : ''}">
    <div class="rhead"><span>${you} + ${them}</span><span>${esc(r.flight.no)}</span></div>
    <div class="rrow"><b>${dirWord}</b><span>${esc(r.deltaLabel.toUpperCase())}</span></div>
    <div class="rrow"><b>${apart}</b><span>${r.distM} M</span></div>
    <div class="rrow"><b>Ride mode</b><span>${r.fare.mode === 'train' ? 'FLYTOGET' : 'SHARED CAB'}</span></div>
    ${vibeRow}
    ${idRow}
    ${fareRow}
    <div class="rsep"></div>
    <div class="rrow"><b>STATUS</b><span class="ok">ELIGIBLE FOR SHARED RIDE</span></div>
  </div>`;
}

/* ---------- router scaffold (views defined in views files) ---------- */
const ROUTES = {}; // path → { title, view }
function currentRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  if (parts[0] === 'match' && parts[1]) return { name: 'match', id: parts[1] };
  if (['trip', 'matches', 'trips'].includes(parts[0])) return { name: parts[0] };
  return { name: 'home' };
}
let activeTimeouts = [];
function later(fn, ms) { activeTimeouts.push(setTimeout(fn, RM ? 1 : ms)); }
function clearLater() { activeTimeouts.forEach(clearTimeout); activeTimeouts = []; }

function render() {
  clearLater();
  const r = currentRoute();
  const app = $('#app');
  const fns = { home: viewHome, trip: viewTrip, matches: viewMatches, trips: viewTrips, match: () => viewMatch(r.id) };
  app.innerHTML = (fns[r.name] || viewHome)();
  document.title = ({
    home: 'Wingman — never ride alone',
    trip: 'New trip · Wingman',
    matches: 'The Board · Wingman',
    trips: 'My trips · Wingman',
    match: (travellerById(r.id) ? publicName(travellerById(r.id)) : 'Match') + ' · Wingman',
  })[r.name];
  // bottom nav active state + badge
  $$('.bottomnav a').forEach(a => a.classList.toggle('on', a.dataset.route === r.name));
  updateNavBadge();
  const after = ({ home: afterHome, trip: afterTrip, matches: afterMatches, trips: null, match: () => afterMatch(r.id) })[r.name];
  if (after) after();
  window.scrollTo(0, 0);
}
function updateNavBadge() {
  const anyUnseen = Object.values(S.m).some(m => m.st === 'cleared' && !m.lockSeen);
  const el = $('.bottomnav a[data-route="matches"] .badge');
  if (el) el.style.display = anyUnseen ? 'block' : 'none';
}

/* ---------- the tick loop: clock, reciprocation, gate, expiry, chat ---------- */
function tick() {
  const c = $('#clock-line'); if (c) c.textContent = simHMS();
  let changed = false;
  const route = currentRoute();

  for (const [id, m] of Object.entries(S.m)) {
    const t = travellerById(id); if (!t) continue;
    // seeded reciprocation → Cleared (the Pass-Lock moment)
    if (m.st === 'joined' && t.recip != null && Date.now() - m.joinedReal > t.recip * 1000) {
      m.st = 'cleared'; m.lockSeen = false; m.clearedHM = simHM(); m.chat = m.chat || [];
      logEvent(`${t.name} joined your route back — you’re cleared`);
      changed = true;
      playPassLock(id);
    }
    // join expires at wheels-down
    if (m.st === 'joined' && S.trip && simMin() > S.trip.timeMin) {
      delete S.m[id];
      logEvent(`Your join to ${publicName(t)} expired at wheels-down`);
      changed = true;
    }
    // other side confirms gate check ~6 s after you
    if (m.st === 'gate_user' && Date.now() - m.gateReal > 6000) {
      m.st = 'boarding'; m.boardHM = simHM();
      logEvent(`${t.name} completed Gate Check — boarding together`);
      changed = true;
    }
    // scripted chat reply
    if (m.pendingReplyAt && Date.now() > m.pendingReplyAt) {
      m.chat.push({ who: 'them', txt: SIGNAL_REPLIES[S.replyIdx % SIGNAL_REPLIES.length], t: simHM() });
      S.replyIdx++; m.pendingReplyAt = null;
      changed = true;
    }
  }
  if (changed) {
    save();
    if (!$('.locklay.show')) {
      if (route.name === 'match' || route.name === 'matches' || route.name === 'trips') render();
      else updateNavBadge();
    } else updateNavBadge();
  }
  // live countdown labels
  $$('.js-wheelsdown').forEach(el => { el.textContent = wheelsDownLeftMin() + ' MIN'; });
}
setInterval(tick, 1000);
