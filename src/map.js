/* ============================================================
   WINGMAN — the convergence map (stylised SVG, not map tiles)
   OSL as a runway node at top, drawn Oslo grid below,
   the 1 km rule as visible geometry.
   ============================================================ */

const MAP_W = 390, MAP_H = 520;
const LON0 = 10.695, LON1 = 10.795, LAT0 = 59.900, LAT1 = 59.958;
const X0 = 28, X1 = 362, YB = 500, YT = 150;
const px = lon => X0 + (lon - LON0) / (LON1 - LON0) * (X1 - X0);
const py = lat => YB - (lat - LAT0) / (LAT1 - LAT0) * (YB - YT);
/* 1 km in map pixels (non-uniform: lon degrees are shorter up here) */
const RING_RX = 1000 / (111320 * Math.cos(59.92 * Math.PI / 180)) * ((X1 - X0) / (LON1 - LON0));
const RING_RY = 1000 / 111132 * ((YB - YT) / (LAT1 - LAT0));

function cityGridSVG() {
  let lines = '';
  for (let x = 10; x <= 380; x += 27) lines += `<line class="gridline" x1="${x}" y1="150" x2="${x}" y2="512"/>`;
  for (let y = 158; y <= 512; y += 27) lines += `<line class="gridline" x1="6" y1="${y}" x2="384" y2="${y}"/>`;
  return `<g opacity=".5" transform="rotate(-7 195 330)">${lines}</g>
    <path class="fjord" d="M30,520 C 60,462 140,440 200,462 C 252,480 330,488 390,478 L390,520 Z"/>
    <text class="maplabel" x="308" y="508">OSLOFJORDEN</text>
    <text class="maplabel" x="186" y="410">OSLO S</text>
    <circle cx="199" cy="423" r="1.6" fill="#5A6690"/>`;
}

function runwaySVG() {
  let lights = '';
  for (let i = 0; i < 9; i++) lights += `<rect class="runway-light" x="${140 + i * 14}" y="60" width="6" height="2.5" rx="1" opacity="${.35 + (i % 3) * .3}"/>`;
  return `<rect class="runway-bar" x="128" y="48" width="134" height="26" rx="6"/>${lights}
    <text class="maplabel amber" x="195" y="42" text-anchor="middle">OSL · GARDERMOEN · 35 KM NORTH</text>
    <text class="maplabel" x="356" y="166" text-anchor="end">N ↑</text>`;
}

function routePath(spot, dir) {
  const x = px(spot.lon), y = py(spot.lat);
  const cx = 195 + (x - 195) * .3, cy = (74 + y) / 2 - 26;
  return dir === 'arriving'
    ? `M195,74 Q${cx},${cy} ${x},${y}`
    : `M${x},${y} Q${cx},${cy} 195,74`;
}

/* opts: { matches, trip, interactive, showSignals, mini } */
function convergenceMapSVG(opts) {
  const { matches = [], trip, interactive = true, showSignals = true, mini = false } = opts;
  const ux = px(trip.spot.lon), uy = py(trip.spot.lat);
  const dir = trip.dir;

  // ambient: same-direction travellers who are NOT on your route — anonymous specks
  const eligibleIds = new Set(matches.map(r => r.t.id));
  const ambient = TRAVELLERS
    .filter(t => t.dir === dir && !eligibleIds.has(t.id))
    .map(t => `<circle class="ambient" cx="${px(t.spot.lon)}" cy="${py(t.spot.lat)}" r="1.8"/>`).join('');

  const signals = matches.map((r, i) => {
    const x = px(r.t.spot.lon), y = py(r.t.spot.lat);
    const pid = `trt-${r.t.id}`;
    const d = routePath(r.t.spot, dir);
    const dur = (6.5 + i * 1.4).toFixed(1);
    const pulse = RM ? '' : `<circle r="2.2" fill="var(--amber)" opacity=".9">
        <animateMotion dur="${dur}s" repeatCount="indefinite"><mpath href="#${pid}"/></animateMotion>
      </circle>`;
    return `<g class="sig-group" data-action="sheet-open" data-id="${r.t.id}" tabindex="${interactive ? 0 : -1}"
        role="button" aria-label="${esc(publicName(r.t))}, ${esc(r.deltaLabel)}, ${r.distM} metres from you">
      <path id="${pid}" class="t-route" d="${d}"/>
      ${pulse}
      <circle class="tdot-halo ${RM ? '' : 'pulse'}" cx="${x}" cy="${y}" r="6" style="animation-delay:${(i * .5).toFixed(1)}s"/>
      <circle class="tdot" cx="${x}" cy="${y}" r="3.4"/>
      ${(() => { // radial label placement so clustered dots don't collide
        const ang = (-90 + i * 72) * Math.PI / 180;
        const lx = x + Math.cos(ang) * 15, ly = y + Math.sin(ang) * 15 + 2.5;
        const anchor = Math.cos(ang) > .3 ? 'start' : Math.cos(ang) < -.3 ? 'end' : 'middle';
        return `<text class="maplabel amber" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}">${r.distM}M</text>`;
      })()}
    </g>`;
  }).join('');

  const uRoute = routePath(trip.spot, dir);
  return `<svg viewBox="0 0 ${MAP_W} ${mini ? 400 : MAP_H}" width="100%" role="img"
      aria-label="Convergence map: your route with ${matches.length} compatible travellers inside your 1 kilometre ring">
    ${runwaySVG()}
    ${cityGridSVG()}
    <ellipse class="ring ${RM || mini ? '' : 'breathe'}" cx="${ux}" cy="${uy}" rx="${RING_RX.toFixed(1)}" ry="${RING_RY.toFixed(1)}"/>
    <text class="maplabel" x="${ux}" y="${(uy + RING_RY + 13).toFixed(0)}" text-anchor="middle">1 KM · ${esc(trip.areaLabel.toUpperCase())}</text>
    <path class="u-route" d="${uRoute}"/>
    ${ambient}
    ${showSignals ? `<g class="sigs">${signals}</g>` : ''}
    <circle class="udot" cx="${ux}" cy="${uy}" r="4.2"/>
    <text class="maplabel" x="${ux}" y="${uy + 4}" dx="9" fill="var(--blush)">YOU</text>
  </svg>`;
}

/* Small two-point route sketch for the match detail page */
function routeSketchSVG(r) {
  const revealed = isRevealed(r.t);
  const meet = meetingPoint(S.trip.dir, r.fare.mode, areaById(r.t.area)?.meet || '');
  const showMeet = mState(r.t.id) === 'cleared' || mState(r.t.id) === 'gate_user' || mState(r.t.id) === 'boarding';
  return `<svg viewBox="0 0 390 130" width="100%" role="img" aria-label="Your two drop-off points, ${r.distM} metres apart">
    <rect width="390" height="130" fill="#070B16" rx="0"/>
    <g opacity=".35">${[40, 80, 120, 160, 200, 240, 280, 320, 360].map(x => `<line class="gridline" x1="${x}" y1="0" x2="${x - 14}" y2="130"/>`).join('')}</g>
    <line x1="88" y1="78" x2="300" y2="52" stroke="var(--amber)" stroke-width="1.4" stroke-dasharray="4 5"/>
    <circle cx="88" cy="78" r="5" fill="var(--blush)"/>
    <text class="maplabel" x="88" y="98" text-anchor="middle" fill="var(--blush)">YOU · ${esc(S.trip.areaLabel.toUpperCase())}</text>
    <circle cx="300" cy="52" r="5" fill="var(--amber)"/>
    <text class="maplabel amber" x="300" y="36" text-anchor="middle">${esc((revealed ? r.t.name : 'THEM').toUpperCase())} · NEAR ${esc((areaById(r.t.area)?.label || '').toUpperCase())}</text>
    <rect x="152" y="54" width="86" height="17" rx="8" fill="#0C1224" stroke="#232E52"/>
    <text class="maplabel amber" x="195" y="65.5" text-anchor="middle" letter-spacing="1">${r.distM} M APART</text>
    ${showMeet ? `<path d="M195,106 l4,7 h-8 z" fill="var(--ok)"/>
      <text class="maplabel" x="195" y="126" text-anchor="middle" fill="var(--ok)">MEET · ${esc(meet.toUpperCase())}</text>` : ''}
  </svg>`;
}
