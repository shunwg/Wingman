/* ============================================================
   WINGMAN — matching engine
   (maps to src/lib/matching.ts in the eventual TanStack build)
   Pure functions, no DOM. Runnable under node for unit tests.
   Hard filters decide WHO appears (non-matches are removed,
   never down-ranked). The weighted score only sets ORDER —
   it is never shown to the user as a grade. The user sees
   the Route Receipt instead.
   ============================================================ */

const MAX_APART_M = 1000; // the 1 km rule
const WEIGHTS = { time: 0.45, dist: 0.35, vibe: 0.20 };

function toMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function fromMin(min) {
  const m = ((min % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

/* Straight-line distance in metres between two coordinates */
function haversineM(aLat, aLon, bLat, bLon) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLon = (bLon - aLon) * rad;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

/* Both parties must tolerate the gap — a match inside your window
   but outside theirs is not a match. */
function windowOK(minA, flexA, minB, flexB) {
  const d = Math.abs(minA - minB);
  return d <= flexA && d <= flexB;
}

function modeOK(a, b) {
  return a === 'either' || b === 'either' || a === b;
}

function openOK(trip, t) {
  if (!trip.open || trip.open === 'everyone') return true;
  return t.gender === (trip.open === 'women' ? 'F' : 'M');
}

/* Per-person privacy: can the USER see traveller t?
   t.visibleTo: 'everyone' | 'verified' | 'women' | 'men'
   trip.verified: user completed BankID / social verification
   trip.gender:  'F' | 'M' | null (not stated) */
function theyShowOK(trip, t) {
  switch (t.visibleTo) {
    case 'verified': return !!trip.verified;
    case 'women': return trip.gender === 'F';
    case 'men': return trip.gender === 'M';
    default: return true;
  }
}
/* And the mirror: does the USER's own visibility setting let t see them?
   (all seeded travellers are verified, so 'verified' always passes) */
function userShowOK(trip, t) {
  switch (trip.visibleTo) {
    case 'women': return t.gender === 'F';
    case 'men': return t.gender === 'M';
    default: return true;
  }
}

function sharedVibes(a, b) {
  return (a || []).filter(v => (b || []).includes(v));
}

/* Order-only score over already-eligible candidates */
function rank(dMin, distM, nShared, nUserVibes, flexA, flexB) {
  const w = Math.max(Math.min(flexA, flexB), 1);
  const time = 1 - dMin / w;
  const dist = 1 - distM / MAX_APART_M;
  const vibe = nUserVibes ? nShared / nUserVibes : 0;
  return WEIGHTS.time * time + WEIGHTS.dist * dist + WEIGHTS.vibe * vibe;
}

/* Effective ride mode for a pair */
function pairMode(a, b) {
  if (a === 'train' || b === 'train') return 'train';
  if (a === 'cab' || b === 'cab') return 'cab';
  return 'cab'; // either + either → default cab (bigger saving)
}

function fareFor(mode, FARES) {
  if (mode === 'train') {
    return { mode, solo: FARES.flytoget, each: FARES.flytoget, saving: 0 };
  }
  const each = Math.round(FARES.cabSolo / 2);
  return { mode, solo: FARES.cabSolo, each, saving: FARES.cabSolo - each };
}

/* Handoff: later flight + 8 → +15 min */
function handoffWindow(minA, minB) {
  const later = Math.max(minA, minB);
  return { from: fromMin(later + 8), to: fromMin(later + 15), fromMin: later + 8, toMin: later + 15 };
}

function meetingPoint(dir, mode, areaMeet) {
  if (dir === 'departing') return areaMeet;              // public spot in the neighbourhood
  return mode === 'train' ? 'Flytoget platform · lower level' : 'Arrivals · Exit B (taxi rank)';
}

/* Route-compatible before privacy: time + mode + your filter + 1 km */
function baseEligible(trip, t, fByNo) {
  if (t.dir !== trip.dir) return false;
  const f = fByNo[t.flight];
  if (!f) return false;
  const tMin = toMin(f.time);
  if (!windowOK(trip.timeMin, trip.flex, tMin, t.flex)) return false;
  if (!modeOK(trip.mode, t.mode)) return false;
  if (!openOK(trip, t)) return false;
  const distM = haversineM(trip.spot.lat, trip.spot.lon, t.spot.lat, t.spot.lon);
  return distM <= MAX_APART_M;
}

/* Route-compatible travellers whose privacy hides them from this user —
   surfaced as a count so the board can say so honestly */
function privacyHidden(trip, travellers, flights) {
  const fByNo = Object.fromEntries(flights.map(f => [f.no, f]));
  const hiddenFromYou = [], hiddenByYou = [];
  for (const t of travellers) {
    if (!baseEligible(trip, t, fByNo)) continue;
    if (!theyShowOK(trip, t)) { hiddenFromYou.push(t); continue; }
    if (!userShowOK(trip, t)) hiddenByYou.push(t);
  }
  return { hiddenFromYou, hiddenByYou };
}

/* trip: { dir, timeMin, flex, mode, vibes[], open, visibleTo, gender,
           verified, spot:{lat,lon}, areaLabel } */
function computeMatches(trip, travellers, flights, FARES) {
  const fByNo = Object.fromEntries(flights.map(f => [f.no, f]));
  const out = [];
  for (const t of travellers) {
    if (!baseEligible(trip, t, fByNo)) continue;
    if (!theyShowOK(trip, t)) continue;   // their privacy
    if (!userShowOK(trip, t)) continue;   // your privacy, mirrored
    const f = fByNo[t.flight];
    const tMin = toMin(f.time);
    const distM = haversineM(trip.spot.lat, trip.spot.lon, t.spot.lat, t.spot.lon);
    const vibes = sharedVibes(trip.vibes, t.vibes);
    const dMin = Math.abs(trip.timeMin - tMin);
    const mode = pairMode(trip.mode, t.mode);
    out.push({
      t, flight: f, tMin, dMin, distM,
      deltaLabel: (tMin >= trip.timeMin ? '+' : '−') + dMin + ' min',
      vibes, mode,
      fare: fareFor(mode, FARES),
      handoff: handoffWindow(trip.timeMin, tMin),
      score: rank(dMin, distM, vibes.length, (trip.vibes || []).length, trip.flex, t.flex),
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

/* How many travellers a wider window would unlock (for the empty-state
   nudge and the trip-form live readout) */
function countEligibleAt(trip, flex, travellers, flights, FARES) {
  return computeMatches({ ...trip, flex }, travellers, flights, FARES).length;
}

if (typeof module !== 'undefined') {
  module.exports = {
    toMin, fromMin, haversineM, windowOK, modeOK, openOK, sharedVibes,
    theyShowOK, userShowOK, privacyHidden,
    rank, pairMode, fareFor, handoffWindow, meetingPoint,
    computeMatches, countEligibleAt, MAX_APART_M, WEIGHTS,
  };
}
