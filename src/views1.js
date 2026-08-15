/* ============================================================
   WINGMAN — views: landing (/) and trip form (/trip)
   ============================================================ */

/* ---------- landing ---------- */
function heroVizSVG() {
  return `<svg viewBox="0 0 420 190" width="100%" aria-hidden="true">
    <rect class="runway-bar" x="160" y="18" width="100" height="18" rx="5"/>
    ${[0,1,2,3,4,5].map(i => `<rect class="runway-light" x="${172 + i * 13}" y="26" width="5" height="2" rx="1" opacity="${.3 + (i % 3) * .3}"/>`).join('')}
    <text class="maplabel amber" x="210" y="12" text-anchor="middle">OSL · TONIGHT</text>
    <path class="heroviz-path" d="M30,180 Q100,80 180,36"/>
    <path class="heroviz-path" d="M390,180 Q320,80 240,36"/>
    <path class="heroviz-path" d="M210,190 Q210,110 210,36"/>
    <path class="heroviz-hot" d="M60,185 Q130,90 195,38"/>
    <path class="heroviz-hot b" d="M360,185 Q290,90 225,38"/>
    <path class="heroviz-join" d="M210,42 Q210,110 210,150 Q210,168 232,178"/>
    <g opacity=".55">${[30,70,110,150,190,230,270,310,350,390].map(x => `<line class="gridline" x1="${x}" y1="158" x2="${x - 10}" y2="190"/>`).join('')}</g>
    <circle cx="232" cy="178" r="3.4" fill="var(--blush)"/>
    <text class="maplabel" x="244" y="182" fill="var(--blush)">TWO PATHS, ONE FARE</text>
  </svg>`;
}

function viewHome() {
  const feed = RECENT_MATCHES.map((m, i) => `<div class="feed-item settle d${i + 1}">
      <span class="who">${esc(m.pair)}</span><span class="rt">${esc(m.route)}</span>
      <span class="sv">−${esc(m.saved)}</span><span class="rt">${esc(m.when)}</span>
    </div>`).join('');
  return `
  <section class="hero">
    <h1 class="settle">Never ride<br><em>alone.</em></h1>
    <p class="sub settle d1">Land at OSL, find the one traveller whose last mile overlaps yours,
      and split the ride. Precise about time and money. Warm about everything else.</p>
    <div class="hero-viz settle d2">${heroVizSVG()}</div>
    <div class="board settle d2" aria-live="polite">
      <div class="board-row"><span class="board-label">LIVE</span><div class="flap" id="hero-flap"></div></div>
    </div>
  </section>
  <div class="doors">
    <button class="door settle d3" data-action="dir-set" data-dir="arriving">
      <span class="gate">GATE 01</span><span class="arr">→</span>
      <h3>Arriving</h3><p>OSL → the city. Find who lands when you do.</p>
    </button>
    <button class="door settle d3" data-action="dir-set" data-dir="departing">
      <span class="gate">GATE 02</span><span class="arr">→</span>
      <h3>Departing</h3><p>The city → OSL. Share the ride out.</p>
    </button>
  </div>
  <div class="h2row"><h2 class="disp">How it works</h2><span class="mono-cap">NO ACCOUNT · VERIFIED ID</span></div>
  <div class="howit">
    <div class="how-stub settle d1"><b>i.</b><div><strong>Type your flight.</strong> Or drop your boarding pass — read on your device, never uploaded.</div></div>
    <div class="how-stub settle d2"><b>ii.</b><div><strong>Watch routes converge.</strong> Anyone in your time window, within 1 km of your drop-off, and whose privacy allows it appears on your board.</div></div>
    <div class="how-stub settle d3"><b>iii.</b><div><strong>Board together.</strong> Verify with BankID or a social login, join a route, clear mutually, meet at a public spot. Split the fare.</div></div>
  </div>
  <div class="h2row"><h2 class="disp">Tonight at OSL</h2><span class="mono-cap">RECENT PAIRINGS</span></div>
  <div class="feed">${feed}</div>
  <div class="gap14"></div>
  <button class="btn btn-amber full" data-action="dir-set" data-dir="arriving">Start with your flight</button>
  ${footerHTML()}`;
}

function afterHome() {
  const el = $('#hero-flap');
  if (!el) return;
  const demo = { dir: 'arriving', timeMin: toMin('22:10'), flex: 45, mode: 'either', vibes: ['quiet', 'music'],
    open: 'everyone', visibleTo: 'everyone', gender: 'F', verified: true,
    spot: areaById('grunerlokka'), areaLabel: 'Grünerløkka' };
  const n = computeMatches(demo, TRAVELLERS, FLIGHTS, FARES).length;
  const facts = [
    `${n} CONVERGING NEAR GRÜNERLØKKA`,
    `NEXT COMPATIBLE LANDING 21:35`,
    `SHARED CAB · SAVE 374 KR EACH`,
    `${TRAVELLERS.filter(t => t.dir === 'arriving').length} TRAVELLERS ON TONIGHT'S BOARD`,
  ];
  let i = 0;
  flapTo(el, facts[0]);
  const rotate = () => { i = (i + 1) % facts.length; flapTo(el, facts[i]); later(rotate, 4200); };
  later(rotate, 4200);
}

/* ---------- trip form ---------- */
let draft = null;
function initDraft(dir) {
  draft = {
    dir: dir || S.trip?.dir || 'arriving',
    flightNo: null, manualTime: '', manualCity: '',
    areaId: S.trip?.areaId || 'grunerlokka',
    flex: S.trip?.flex || 45,
    mode: S.trip?.mode || 'either',
    vibes: S.trip?.vibes ? [...S.trip.vibes] : ['quiet', 'music'],
    open: S.trip?.open || 'everyone',
    visibleTo: S.trip?.visibleTo || 'everyone',
    gender: S.trip?.gender ?? null,
    name: S.trip?.name || 'Shun',
    parsed: null, parsing: false,
  };
}

function draftTrip() { // draft → trip-shaped object for live counts
  const f = draft.flightNo && draft.flightNo !== 'manual' ? flightByNo(draft.flightNo) : null;
  const timeMin = f ? toMin(f.time) : (draft.manualTime && /^\d{1,2}:\d{2}$/.test(draft.manualTime) ? toMin(draft.manualTime) : toMin('22:10'));
  const area = areaById(draft.areaId);
  return { dir: draft.dir, timeMin, flex: draft.flex, mode: draft.mode, vibes: draft.vibes,
    open: draft.open, visibleTo: draft.visibleTo, gender: draft.gender, verified: !!S.verify,
    spot: { lat: area.lat, lon: area.lon }, areaLabel: area.label };
}
function liveCount() { return computeMatches(draftTrip(), TRAVELLERS, FLIGHTS, FARES).length; }
function liveHidden() { return privacyHidden(draftTrip(), TRAVELLERS, FLIGHTS).hiddenFromYou.length; }

function verifyCardHTML() {
  if (S.verify) {
    return `<div class="vcard">
      <div class="vc-done"><span class="vchip dark">✓ ${VERIFY_LABEL[S.verify.method]}</span>
        <span>You're verified. Verified-only travellers can now see you.</span></div>
    </div>`;
  }
  return `<div class="vcard">
    <p>Some travellers are visible to <b style="color:var(--text)">verified people only</b>.
      Verify once and you're covered for every trip.</p>
    <div class="vc-grid">
      <button class="vbtn primary" data-action="verify-run" data-m="bankid">Verify with BankID</button>
      <button class="vbtn" data-action="verify-run" data-m="linkedin"><span class="dot"></span>LinkedIn</button>
      <button class="vbtn" data-action="verify-run" data-m="instagram"><span class="dot"></span>Instagram</button>
      <button class="vbtn" data-action="verify-run" data-m="facebook"><span class="dot"></span>Facebook</button>
    </div>
  </div>`;
}

function viewTrip() {
  if (!draft) initDraft();
  const arriving = draft.dir === 'arriving';
  const flights = FLIGHTS.filter(f => f.dir === draft.dir);
  const flightChips = flights.map(f =>
    `<button class="tag ${draft.flightNo === f.no ? 'on' : ''}" data-action="pick-flight" data-no="${f.no}">
      ${f.no} · ${esc(f.city).toUpperCase()} · ${f.time}</button>`).join('');
  const areas = AREAS.map(a => `<option value="${a.id}" ${draft.areaId === a.id ? 'selected' : ''}>${esc(a.label)}</option>`).join('');
  const vibeDefs = [['quiet', 'QUIET RIDE'], ['chatty', 'CHATTY'], ['music', 'MUSIC'], ['business', 'BUSINESS TALK']];
  const modeDefs = [['cab', 'CAB'], ['train', 'FLYTOGET'], ['either', 'EITHER']];
  const openDefs = [['everyone', 'EVERYONE'], ['women', 'WOMEN'], ['men', 'MEN']];
  const visDefs = [['everyone', 'EVERYONE'], ['verified', 'VERIFIED ONLY'], ['women', 'WOMEN ONLY'], ['men', 'MEN ONLY']];
  const genDefs = [['F', 'WOMAN'], ['M', 'MAN'], [null, 'RATHER NOT SAY']];
  const trip = draftTrip();
  const hid = liveHidden();
  const parseBlock = draft.parsing
    ? `<div class="parsecard">${flapHTML('READING PASS…', 'dim')}</div>`
    : draft.parsed
      ? `<div class="parsecard">
          <div class="flabel" style="margin-bottom:6px">Parsed from your pass <span class="hint">EDITABLE</span></div>
          ${flapHTML('DY1305 · CPH→OSL · 22:10 TONIGHT')}
          <div class="gap8"></div>
          <button class="btn btn-amber sm" data-action="use-parse">Use this flight</button>
          <div class="gap8"></div>
          <p class="smallnote">Parsed locally in this prototype — the file never leaves your device.</p>
        </div>`
      : '';
  return `
  <div class="h2row"><h2 class="disp">${arriving ? 'Landing tonight' : 'Flying out tonight'}</h2>
    <span class="mono-cap">${arriving ? 'OSL → CITY' : 'CITY → OSL'}</span></div>

  <div class="fgroup">
    <div class="flabel">Direction</div>
    <div class="tags">
      <button class="tag ${arriving ? 'on' : ''}" data-action="set-dir" data-dir="arriving">ARRIVING · OSL → CITY</button>
      <button class="tag ${!arriving ? 'on' : ''}" data-action="set-dir" data-dir="departing">DEPARTING · CITY → OSL</button>
    </div>
  </div>

  <div class="fgroup">
    <div class="flabel">Your flight tonight <span class="hint" data-action="demo-flight" style="cursor:pointer">USE DEMO ${arriving ? 'DY1305' : 'DY1309'}</span></div>
    <div class="tags">${flightChips}
      <button class="tag ${draft.flightNo === 'manual' ? 'on' : ''}" data-action="pick-flight" data-no="manual">TYPE IT MANUALLY</button>
    </div>
    ${draft.flightNo === 'manual' ? `<div class="gap8"></div>
      <input type="text" id="manual-time" inputmode="numeric" placeholder="${arriving ? 'Lands at… e.g. 22:15' : 'Departs at… e.g. 23:00'}" value="${esc(draft.manualTime)}" aria-label="Flight time">` : ''}
  </div>

  <div class="fgroup">
    <div class="flabel">Or drop your boarding pass</div>
    <label class="drop" id="dropzone" for="ticket-file">
      <span class="mono">IMAGE OR PDF</span><br>Tap to choose, or drag it here.<br>
      <span style="font-size:11px; color:var(--dimmer)">Read on your device. No OCR, no upload — a mocked parse in this prototype.</span>
    </label>
    <input type="file" id="ticket-file" accept="image/*,.pdf">
    ${parseBlock}
  </div>

  <div class="fgroup">
    <div class="flabel">${arriving ? 'Where are you headed?' : 'Where do you start?'} <span class="hint">OTHERS SEE “NEAR ${esc(areaById(draft.areaId).label.toUpperCase())}” ONLY</span></div>
    <div class="selwrap"><select id="area-sel" aria-label="Neighbourhood">${areas}</select></div>
    <div class="minimap">${convergenceMapSVG({ matches: [], trip, showSignals: false, interactive: false, mini: true })}</div>
    <p class="smallnote" style="margin-top:9px">The blush ring is your 1 km match zone. Nobody ever sees an address — yours or theirs.</p>
  </div>

  <div class="fgroup">
    <div class="flabel">Time flexibility <span class="hint" id="flex-read">±${draft.flex} MIN · ${liveCount()} IN REACH</span></div>
    <input type="range" id="flex-range" min="15" max="120" step="15" value="${draft.flex}" aria-label="Time flexibility in minutes">
  </div>

  <div class="fgroup">
    <div class="flabel">Ride mode</div>
    <div class="tags">${modeDefs.map(([v, l]) => `<button class="tag ${draft.mode === v ? 'on' : ''}" data-action="set-mode" data-v="${v}">${l}</button>`).join('')}</div>
  </div>

  <div class="fgroup">
    <div class="flabel">Vibe tags</div>
    <div class="tags">${vibeDefs.map(([v, l]) => `<button class="tag ${draft.vibes.includes(v) ? 'blush-on' : ''}" data-action="toggle-vibe" data-v="${v}">${l}</button>`).join('')}</div>
  </div>

  <div class="h2row"><h2 class="disp">About you</h2><span class="mono-cap">PRIVACY · VERIFICATION</span></div>

  <div class="fgroup">
    <div class="flabel">First name on your pass <span class="hint">SHARED AFTER A MUTUAL CLEAR</span></div>
    <input type="text" id="name-input" value="${esc(draft.name)}" maxlength="18" aria-label="Your first name">
  </div>

  <div class="fgroup">
    <div class="flabel">You are</div>
    <div class="tags">${genDefs.map(([v, l]) => `<button class="tag ${draft.gender === v ? 'on' : ''}" data-action="set-gender" data-v="${v ?? ''}">${l}</button>`).join('')}</div>
    <p class="smallnote" style="margin-top:8px">Only used to honour visibility choices — some travellers are visible to women or men only.</p>
  </div>

  <div class="fgroup">
    <div class="flabel">Who can see you</div>
    <div class="tags">${visDefs.map(([v, l]) => `<button class="tag ${draft.visibleTo === v ? 'on' : ''}" data-action="set-vis" data-v="${v}">${l}</button>`).join('')}</div>
  </div>

  <div class="fgroup">
    <div class="flabel">Match me with</div>
    <div class="tags">${openDefs.map(([v, l]) => `<button class="tag ${draft.open === v ? 'on' : ''}" data-action="set-open" data-v="${v}">${l}</button>`).join('')}</div>
  </div>

  <div class="fgroup">
    <div class="flabel">Identity <span class="hint">${S.verify ? 'VERIFIED' : 'REQUIRED TO JOIN A ROUTE'}</span></div>
    ${verifyCardHTML()}
    ${!S.verify && hid ? `<p class="smallnote" style="margin-top:9px">${hid} compatible traveller${hid > 1 ? 's are' : ' is'} currently hidden from you by their privacy choices — verifying reveals the verified-only ones.</p>` : ''}
  </div>

  <button class="btn btn-amber full" data-action="submit-trip" id="submit-trip">Open the board</button>
  <div class="gap8"></div>
  <p class="smallnote center" id="trip-warn"></p>
  ${footerHTML()}`;
}

function afterTrip() {
  const range = $('#flex-range');
  if (range) range.addEventListener('input', () => {
    draft.flex = Number(range.value);
    const el = $('#flex-read');
    if (el) el.textContent = `±${draft.flex} MIN · ${liveCount()} IN REACH`;
  });
  const area = $('#area-sel');
  if (area) area.addEventListener('change', () => { draft.areaId = area.value; render(); });
  const name = $('#name-input');
  if (name) name.addEventListener('input', () => { draft.name = name.value; });
  const mt = $('#manual-time');
  if (mt) mt.addEventListener('input', () => { draft.manualTime = mt.value; });
  const file = $('#ticket-file');
  if (file) file.addEventListener('change', () => { if (file.files.length) mockParse(); });
  const dz = $('#dropzone');
  if (dz) {
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('over'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); mockParse(); });
  }
}

function mockParse() {
  draft.parsing = true; render();
  later(() => { draft.parsing = false; draft.parsed = { flightNo: 'DY1305' }; render(); }, 1300);
}

function submitTrip() {
  const warn = $('#trip-warn');
  const f = draft.flightNo && draft.flightNo !== 'manual' ? flightByNo(draft.flightNo) : null;
  if (!f && !(draft.flightNo === 'manual' && /^\d{1,2}:\d{2}$/.test(draft.manualTime))) {
    if (warn) warn.textContent = 'Pick a flight (or type a time like 22:15) so the board knows your window.';
    return;
  }
  const area = areaById(draft.areaId);
  S.trip = {
    dir: draft.dir,
    flightNo: f ? f.no : 'MANUAL',
    timeMin: f ? toMin(f.time) : toMin(draft.manualTime),
    timeLabel: f ? f.time : draft.manualTime,
    originCity: f ? f.city : (draft.manualCity || 'Manual entry'),
    originIata: f ? f.iata : '···',
    areaId: area.id, areaLabel: area.label,
    spot: { lat: area.lat, lon: area.lon },
    flex: draft.flex, mode: draft.mode, vibes: [...draft.vibes],
    open: draft.open, visibleTo: draft.visibleTo, gender: draft.gender,
    name: (draft.name || 'You').trim() || 'You',
    createdHM: simHM(),
  };
  S.m = {}; S.passed = []; S.boardPlayed = false; S.log = [];
  logEvent('Trip created — your signal is on the board');
  save();
  location.hash = '#/matches';
}

function footerHTML() {
  return `<div class="footer">WINGMAN PROTOTYPE · SEEDED DATA · SIMULATED CLOCK<br>
    VERIFICATION IS MOCKED · NO UPLOADS · NO REAL FLIGHTS ·
    <button data-action="reset">RESET DEMO</button></div>`;
}
