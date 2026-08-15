/* ============================================================
   WINGMAN — views: the board (/matches), match detail, trips,
   Pass-Lock overlay, Gate Check, Signals, event wiring
   ============================================================ */

let matchView = 'map'; // 'map' | 'list' — list is the accessible alternate

/* ---------- /matches : the board ---------- */
function viewMatches() {
  if (!S.trip) {
    return `<div class="gap28"></div>
      <div class="sign"><span class="arr">→</span> NO TRIP ON THE BOARD YET</div>
      <div class="gap14"></div>
      <p class="smallnote">Tell the board your flight and your last mile, and it will start watching for convergence.</p>
      <div class="gap14"></div>
      <button class="btn btn-amber full" data-action="dir-set" data-dir="arriving">Enter a flight</button>
      ${footerHTML()}`;
  }
  const ms = currentMatches();
  const arriving = S.trip.dir === 'arriving';
  const hiddenN = S.passed.length + Object.values(S.m).filter(m => m.st === 'ended').length;
  return `
  <div class="board" aria-live="polite">
    <div class="board-row"><span class="board-label">FLT</span><div class="flap" id="b-row1"></div></div>
    <div class="board-row"><span class="board-label">OPS</span><div class="flap dim" id="b-row2"></div></div>
  </div>
  <div class="gap14"></div>
  <div style="display:flex; gap:10px; align-items:center; justify-content:space-between">
    <div class="viewtoggle" role="tablist" style="flex:1">
      <button role="tab" aria-selected="${matchView === 'map'}" class="${matchView === 'map' ? 'on' : ''}" data-action="set-view" data-v="map">CONVERGENCE MAP</button>
      <button role="tab" aria-selected="${matchView === 'list'}" class="${matchView === 'list' ? 'on' : ''}" data-action="set-view" data-v="list">LIST</button>
    </div>
    <span class="countpill">${ms.length}</span>
  </div>
  ${privacyRows()}
  <div class="gap14"></div>
  ${matchView === 'map' ? mapBlock(ms) : listBlock(ms)}
  ${ms.length === 0 ? emptyStateBlock() : ''}
  ${hiddenN ? `<p class="smallnote center" style="margin-top:10px">${hiddenN} traveller${hiddenN > 1 ? 's' : ''} hidden (different route / ended).</p>` : ''}
  <div class="gap14"></div>
  <div class="sign"><span class="arr">→</span><span>JOINS EXPIRE AT ${arriving ? 'WHEELS-DOWN' : 'PUSHBACK'} · <b class="js-wheelsdown" style="color:var(--amber); font-weight:500">${wheelsDownLeftMin()} MIN</b></span></div>
  ${footerHTML()}
  <div class="sheet" id="sheet"><div class="sheet-inner" id="sheet-inner"></div></div>`;
}

/* Route-compatible travellers hidden by privacy — said out loud, both ways */
function privacyRows() {
  const ph = privacyHidden(effTrip(), TRAVELLERS, FLIGHTS);
  const from = ph.hiddenFromYou.length, by = ph.hiddenByYou.length;
  if (!from && !by) return '';
  let out = '<div class="gap8"></div>';
  if (from) {
    const anyVerifiedOnly = ph.hiddenFromYou.some(t => t.visibleTo === 'verified');
    out += (!S.verify && anyVerifiedOnly)
      ? `<button class="sign" data-action="verify-open"><span class="arr">→</span><span>${from} ON YOUR ROUTE, HIDDEN BY THEIR PRIVACY · <b>VERIFY TO REVEAL</b></span></button>`
      : `<div class="sign"><span class="arr">→</span><span>${from} ON YOUR ROUTE, HIDDEN BY THEIR PRIVACY CHOICES</span></div>`;
  }
  if (by) {
    out += `<p class="smallnote" style="margin-top:8px">Your visibility setting hides you from ${by} compatible traveller${by > 1 ? 's' : ''} — they can't see or join you.</p>`;
  }
  return out;
}

function mapBlock(ms) {
  return `<div class="mapwrap map-reveal" id="mapwrap">
    ${convergenceMapSVG({ matches: ms, trip: S.trip })}
    <div class="map-legend">
      <span><i style="background:var(--blush)"></i>YOU + 1 KM RING</span><br>
      <span><i style="background:var(--amber)"></i>ON YOUR ROUTE · TAP THEM</span><br>
      <span><i style="background:#4A5578"></i>OTHERS TONIGHT (NOT COMPATIBLE)</span>
    </div>
  </div>`;
}

function listBlock(ms) {
  if (!ms.length) return '';
  return ms.map((r, i) => `
    <div class="pass mcard settle d${Math.min(i + 1, 5)}" style="--tear:72%">
      <div class="pass-head"><span class="pass-kicker">WINGMAN · CANDIDATE ${String(i + 1).padStart(2, '0')}</span>
        <span class="mono" style="font-size:11px">${esc(r.flight.no)}</span></div>
      <div class="pass-body">
        <div class="row">
          <div class="avatar bone-b">${avatarSVG(r.t, isRevealed(r.t))}</div>
          <div style="flex:1">
            <h3 style="font-size:18px">${esc(publicName(r.t))}</h3>
            <div class="mono" style="font-size:10px; color:var(--ink-soft); letter-spacing:.06em; margin-top:2px">
              ${esc(r.flight.no)} · ${esc(r.deltaLabel.toUpperCase())} · NEAR ${esc(areaById(r.t.area).label.toUpperCase())}</div>
          </div>
          ${stateChip(r.t.id)}
        </div>
        ${rulerHTML(r.distM, true)}
        <div style="display:flex; align-items:center; gap:8px; margin:7px 0 2px">
          ${verifyChip(r.t)}<span class="vislabel">${esc(VIS_LABEL[r.t.visibleTo])}</span>
        </div>
        <div class="gap8"></div>
        <div class="tags">${r.vibes.map(v => `<span class="tag mini blush-on">${esc(v.toUpperCase())}</span>`).join('')}
          <span class="tag mini">${r.fare.mode === 'train' ? 'FLYTOGET' : 'SHARED CAB'}</span>
          ${r.fare.saving ? `<span class="tag mini on">SAVE ${r.fare.saving} KR</span>` : ''}</div>
      </div>
      <div class="tear"></div>
      <div class="pass-stub" style="display:flex; gap:8px">
        <a class="btn btn-bone sm" style="flex:1" href="#/match/${r.t.id}">Route receipt</a>
        ${actionButtons(r.t.id, 'sm')}
      </div>
    </div>`).join('');
}

function emptyStateBlock() {
  const unlock120 = countEligibleAt(effTrip(), 120, TRAVELLERS, FLIGHTS, FARES);
  const tonight = TRAVELLERS.filter(t => t.dir === S.trip.dir).length;
  return `<div class="gap14"></div>
  <div class="board">
    <div class="board-row"><span class="board-label">STS</span>${flapHTML("YOU'RE FIRST ON THIS ROUTE", 'blush')}</div>
    <div class="board-row"><span class="board-label">SIG</span>${flapHTML('SIGNAL ON UNTIL WHEELS-DOWN', 'dim')}</div>
  </div>
  <div class="gap14"></div>
  <div class="receipt on-dark">
    <div class="rhead"><span>YOUR SOLO BASELINE</span><span>OSL ⇄ ${esc(S.trip.areaLabel.toUpperCase())}</span></div>
    <div class="rrow"><b>Cab, alone</b><span>${FARES.cabSolo} KR</span></div>
    <div class="rrow"><b>Flytoget</b><span>${FARES.flytoget} KR</span></div>
    <div class="rrow"><b>Vy local train</b><span>${FARES.vy} KR</span></div>
    <div class="rsep"></div>
    <div class="rrow"><b>If one traveller converges</b><span class="ok">CAB DROPS TO ${Math.round(FARES.cabSolo / 2)} KR</span></div>
  </div>
  <div class="gap14"></div>
  ${unlock120 > 0 && S.trip.flex < 120
    ? `<button class="btn btn-ghost full" data-action="widen">Widen to ±120 min — <span class="mono">${unlock120}</span> in reach</button>`
    : `<div class="sign"><span class="arr">→</span> YOUR WINDOW ISN'T THE CONSTRAINT — ROUTES JUST HAVEN'T CROSSED YET</div>`}
  <div class="gap8"></div>
  <p class="smallnote center">${tonight} travellers are ${S.trip.dir} through OSL tonight. We'll flag anyone who converges before ${S.trip.dir === 'arriving' ? 'you land' : 'you fly'}.</p>`;
}

function afterMatches() {
  if (!S.trip) return;
  const ms = currentMatches();
  const r1 = $('#b-row1'), r2 = $('#b-row2'), map = $('#mapwrap');
  const arriving = S.trip.dir === 'arriving';
  const iata = S.trip.originIata || '···';
  const line1 = `${S.trip.flightNo} · ${arriving ? iata + '→OSL' : 'OSL→' + iata} · ${arriving ? 'LANDS' : 'DEP'} ${S.trip.timeLabel}`;
  const nFlights = new Set(TRAVELLERS.filter(t => t.dir === S.trip.dir).map(t => t.flight)).size;
  const nTrav = TRAVELLERS.filter(t => t.dir === S.trip.dir).length;
  const maxSave = ms.some(m => m.fare.saving) ? Math.max(...ms.map(m => m.fare.saving)) : 0;
  const finale = ms.length
    ? `${ms.length} ON YOUR ROUTE${maxSave ? ' · SAVE ' + maxSave + ' KR EACH' : ' · FLYTOGET TOGETHER'}`
    : `NO CONVERGENCE YET · WATCHING`;
  if (S.boardPlayed || RM) {
    flapTo(r1, line1); flapTo(r2, finale);
    if (map) map.classList.add('on');
    return;
  }
  /* the first 10 seconds — the board writes itself */
  flapTo(r1, line1);
  later(() => flapTo(r2, `SCANNING ${nTrav} TRAVELLERS · ${nFlights} FLIGHTS`), 1300);
  later(() => { if (map) map.classList.add('on'); }, 1700);
  later(() => flapTo(r2, `${ms.length ? ms.length + ' INSIDE YOUR 1 KM RING' : 'RING DRAWN · NOBODY INSIDE YET'}`), 3600);
  later(() => { flapTo(r2, finale); S.boardPlayed = true; save(); }, 5600);
}

/* ---------- shared state chips + action buttons ---------- */
function stateChip(id) {
  const st = mState(id);
  const map = {
    joined: ['ROUTE JOINED', 'ink'], cleared: ['CLEARED', ''],
    gate_user: ['GATE CHECK…', ''], boarding: ['BOARDING', 'ok'],
  };
  if (!map[st]) return '';
  return `<span class="stamp ${map[st][1]}" style="font-size:8.5px; padding:3px 7px">${map[st][0]}</span>`;
}

function actionButtons(id, size = '') {
  const st = mState(id);
  if (st === 'none') return `
    <button class="btn btn-amber ${size}" data-action="join-open" data-id="${id}">Join route</button>
    <button class="btn btn-ghost ${size}" data-action="pass" data-id="${id}" title="No judgement — just geography">✕</button>`;
  if (st === 'joined') return `<span class="tag mini">JOINED · EXPIRES AT WHEELS-DOWN</span>`;
  return `<a class="btn btn-blush ${size}" href="#/match/${id}">Open</a>`;
}

/* ---------- bottom sheet (map tap) ---------- */
function openSheet(id) {
  const r = matchFor(id); if (!r) return;
  $('#sheet-inner').innerHTML = `
    <div class="pass" style="--tear:66%">
      <div class="pass-head"><span class="pass-kicker">WINGMAN · SIGNAL</span>
        <button class="btn btn-ghost sm" data-action="sheet-close" style="border:none; color:var(--ink-soft); padding:4px 8px" aria-label="Close">✕</button></div>
      <div class="pass-body">
        <div class="row" style="display:flex; gap:12px; align-items:center">
          <div class="avatar bone-b">${avatarSVG(r.t, isRevealed(r.t))}</div>
          <div><h3 style="font-size:18px">${esc(publicName(r.t))}</h3>
            <div style="display:flex; align-items:center; gap:7px; margin-top:3px">${verifyChip(r.t)}
              <span class="mono" style="font-size:10px; color:var(--ink-soft)">${esc(r.deltaLabel.toUpperCase())}</span></div></div>
        </div>
        ${rulerHTML(r.distM, true)}
        <div class="gap8"></div>
        ${receiptHTML(r)}
      </div>
      <div class="tear"></div>
      <div class="pass-stub" style="display:flex; gap:8px">
        <a class="btn btn-bone sm" style="flex:1; border:1.5px solid #D6CDBA" href="#/match/${r.t.id}">Full pass</a>
        ${actionButtons(r.t.id, 'sm')}
      </div>
    </div>`;
  $('#sheet').classList.add('open');
}

/* ---------- /match/:id detail ---------- */
function viewMatch(id) {
  const t = travellerById(id);
  const r = matchFor(id);
  if (!t || !r) {
    return `<div class="gap28"></div><div class="sign"><span class="arr">→</span> THIS TRAVELLER ISN'T ON YOUR ROUTE</div>
      <div class="gap14"></div><a class="btn btn-ghost full" href="#/matches">← BACK TO THE BOARD</a>${footerHTML()}`;
  }
  const st = mState(id);
  const revealed = isRevealed(t);
  const meet = meetingPoint(S.trip.dir, r.fare.mode, areaById(t.area)?.meet || '');
  const fareBlock = r.fare.mode === 'train'
    ? `<div class="money on-dark"><span class="now">${r.fare.each} KR <small>EACH · FLYTOGET</small></span></div>`
    : `<div class="money on-dark"><span class="was">${r.fare.solo} KR SOLO</span><span class="arr">→</span>
       <span class="now">${r.fare.each} KR <small>EACH</small></span></div>`;

  return `
  <a href="#/matches" class="mono-cap" style="font-family:var(--mono); font-size:10px; letter-spacing:.2em; color:var(--text-dim)">← THE BOARD</a>
  <div class="gap14"></div>
  <div class="pass settle" style="--tear:58%">
    <div class="pass-head"><span class="pass-kicker">WINGMAN BOARDING PASS</span>
      <span class="mono" style="font-size:12px; font-weight:700">${esc(r.flight.no)}</span></div>
    <div class="pass-body">
      <div style="display:flex; gap:14px; align-items:center">
        <div class="avatar bone-b" style="width:58px; height:58px">${avatarSVG(t, revealed)}</div>
        <div>
          <h3>${esc(publicName(t))}</h3>
          <div style="display:flex; align-items:center; gap:7px; margin:4px 0 3px">${verifyChip(t)}
            <span class="vislabel">${esc(VIS_LABEL[t.visibleTo])}</span></div>
          <div class="mono" style="font-size:10px; color:var(--ink-soft); letter-spacing:.05em">
            NEAR ${esc(areaById(t.area).label.toUpperCase())} · ${revealed ? 'IDENTITY SHARED' : 'IDENTITY UNLOCKS AT MUTUAL CLEAR'}</div>
        </div>
      </div>
      <p style="font-size:13px; color:#3A404E; margin:10px 0 4px; font-style:italic">“${esc(t.line)}”</p>
      <div>
        <span class="pfield"><b>FLIGHT</b><span>${esc(r.flight.no)}</span></span>
        <span class="pfield"><b>${S.trip.dir === 'arriving' ? 'FROM' : 'TO'}</b><span>${esc(r.flight.iata)}</span></span>
        <span class="pfield"><b>${S.trip.dir === 'arriving' ? 'LANDS' : 'DEPARTS'}</b><span>${esc(r.flight.time)}</span></span>
        <span class="pfield"><b>FLEX</b><span>±${t.flex}′</span></span>
      </div>
      <div class="gap8"></div>
      <div class="tags">${t.vibes.map(v => `<span class="tag mini ${r.vibes.includes(v) ? 'blush-on' : ''}">${esc(v.toUpperCase())}${r.vibes.includes(v) ? ' ✓' : ''}</span>`).join('')}</div>
    </div>
    <div class="perf">${'<i></i>'.repeat(24)}</div>
    <div class="tear" style="margin-top:6px"></div>
    <div class="pass-stub">
      ${rulerHTML(r.distM, true)}
      <div class="gap8"></div>
      ${receiptHTML(r)}
      <div class="gap8"></div>
      <div class="stubrow">${barcodeSVG(r.t.id + r.flight.no)}
        <span class="mono" style="font-size:9px; color:#9B937F; letter-spacing:.14em">SEQ ${String((r.t.id.charCodeAt(0) * 7) % 900 + 100)} · ${esc(r.flight.no)}</span></div>
    </div>
  </div>

  <div class="h2row"><h2 class="disp">The shared route</h2><span class="mono-cap">STRAIGHT-LINE · SEEDED COORDS</span></div>
  <div class="mapwrap settle d1">${routeSketchSVG(r)}</div>
  <div class="gap8"></div>
  ${fareBlock}
  ${stateSection(r, st, meet)}
  ${footerHTML()}`;
}

function stateSection(r, st, meet) {
  const id = r.t.id;
  const name = esc(r.t.name);
  if (st === 'none') {
    return `<div class="gap14"></div>
    <div id="join-zone">
      <button class="btn btn-amber full" data-action="join-open" data-id="${id}">Join my route</button>
      <div class="gap8"></div>
      <button class="btn btn-ghost full" data-action="pass" data-id="${id}">Different route</button>
      <div class="gap8"></div>
      <p class="smallnote center">A join is soft: it expires at wheels-down (<span class="js-wheelsdown mono">${wheelsDownLeftMin()} MIN</span>) and sends only a template note — never your details.${S.verify ? '' : ' You\u2019ll verify your identity first.'}</p>
    </div>`;
  }
  if (st === 'joined') {
    return `<div class="gap14"></div>
    <div class="sign"><span class="arr">→</span> ROUTE JOINED · EXPIRES AT WHEELS-DOWN IN <span class="js-wheelsdown" style="color:var(--amber)">${wheelsDownLeftMin()} MIN</span></div>
    <div class="gap8"></div>
    <p class="smallnote center">If they join back before then, you'll clear together. If not, it quietly lapses — no ghosting, no awkwardness.</p>
    <div class="gap8"></div>
    <button class="btn btn-ghost full" data-action="plans" data-id="${id}">Plans changed — withdraw</button>`;
  }
  // cleared / gate_user / boarding — the shared plan
  const m = S.m[id];
  const gateBlock =
    st === 'cleared' ? `<button class="btn btn-amber full" data-action="gate-open" data-id="${id}">Gate check — confirm the plan</button>
      <div class="gap8"></div><p class="smallnote center">Both of you confirm mode, fare and window before it's real.</p>`
    : st === 'gate_user' ? `<div class="sign"><span class="arr">→</span> YOU'RE CHECKED IN · WAITING FOR ${name.toUpperCase()}…</div>`
    : `<div style="text-align:center; padding:6px 0 2px"><span class="stamp ok pop" style="font-size:14px; padding:8px 16px">BOARDING TOGETHER</span></div>
       <div class="gap8"></div>${stubCard(r)}`;
  return `
  <div class="gap14"></div>
  <div class="sign settle"><span class="arr">→</span> MEET · ${esc(meet.toUpperCase())} · ${r.handoff.from}–${r.handoff.to}</div>
  <div class="gap14"></div>
  <div class="safety settle d1"><span class="mono">SHARED SO FAR</span><br>
    <b>Shared:</b> first names, photos, flight numbers, this public meeting point.<br>
    <b>Not shared:</b> addresses, phone numbers, live location — and the app never asks for them.</div>
  <div class="gap14"></div>
  ${gateBlock}
  <div class="h2row"><h2 class="disp">Signals</h2><span class="mono-cap">LOW-PRESSURE · TEMPLATED</span></div>
  ${chatBlock(id)}
  <div class="gap14"></div>
  <button class="btn btn-ghost full" data-action="plans" data-id="${id}">Plans changed — no longer looking</button>`;
}

function stubCard(r) {
  return `<div class="pass" style="--tear:50%">
    <div class="pass-head"><span class="pass-kicker">SHARED-RIDE STUB · SCREENSHOT ME</span>
      <span class="mono" style="font-size:11px">${esc(S.trip.timeLabel)}</span></div>
    <div class="pass-body" style="text-align:center; padding:16px">
      <h3 style="font-size:20px">${esc(S.trip.name)} + ${esc(r.t.name)}</h3>
      <div class="mono" style="font-size:11px; color:var(--ink-soft); margin-top:4px">
        ${S.trip.dir === 'arriving' ? 'OSL → ' + esc(S.trip.areaLabel).toUpperCase() : esc(S.trip.areaLabel).toUpperCase() + ' → OSL'}
        · ${r.fare.mode === 'train' ? 'FLYTOGET' : 'SHARED CAB'}</div>
      <div class="money"><span class="was">${r.fare.solo} KR</span><span class="arr">→</span>
        <span class="now">${r.fare.each} KR <small>EACH</small></span></div>
      <span class="stamp blush">CLEARED FOR SHARED RIDE</span>
      <div class="gap14"></div>
      <div class="stubrow" style="justify-content:center">${barcodeSVG(r.t.id + S.trip.name)}</div>
    </div>
  </div>`;
}

function chatBlock(id) {
  const m = S.m[id]; if (!m) return '';
  const msgs = (m.chat || []).map(c => `<div class="bubble ${c.who === 'me' ? 'me' : 'them'}">${esc(c.txt)}<span class="t">${esc(c.t)}</span></div>`).join('');
  const quickies = ["I'll be at arrivals", 'Happy to split a cab', 'Train works for me', 'Running 10 min late'];
  return `<div class="chat" id="chat">${msgs || '<p class="smallnote">Say something small. The templates below are enough.</p>'}</div>
  <div class="quickies">${quickies.map((q, i) => `<button class="tag" data-action="quick" data-id="${id}" data-q="${esc(q)}">${esc(q).toUpperCase()}</button>`).join('')}</div>
  <div class="chatrow"><input type="text" id="chat-input" placeholder="Or write your own…" maxlength="120" aria-label="Message">
    <button class="btn btn-amber sm" data-action="chat-send" data-id="${id}">Send</button></div>`;
}

function afterMatch(id) {
  const m = S.m[id];
  if (m && m.st === 'cleared' && !m.lockSeen && !$('.locklay.show')) playPassLock(id);
  const chat = $('#chat'); if (chat) chat.scrollTop = chat.scrollHeight;
  const input = $('#chat-input');
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(id, input.value); });
}

/* ---------- join note templates ---------- */
function openJoinTemplates(id) {
  const zone = $('#join-zone');
  const notes = ['Happy to split a cab', "I'll be at arrivals", 'Train works for me too'];
  const html = `<div class="flabel">Send with one template note — that's all they see</div>
    <div class="tags">${notes.map(n => `<button class="tag" data-action="join" data-id="${id}" data-note="${esc(n)}">“${esc(n).toUpperCase()}”</button>`).join('')}</div>
    <div class="gap8"></div><button class="btn btn-ghost full sm" data-action="join" data-id="${id}" data-note="">Send without a note</button>`;
  if (zone) { zone.innerHTML = html; return; }
  // from list/sheet: join immediately with default note
  doJoin(id, notes[0]);
}

function doJoin(id, note) {
  const t = travellerById(id);
  S.m[id] = { st: 'joined', joinedReal: Date.now(), joinedHM: simHM(), note, chat: [] };
  logEvent(`You joined the route of ${publicName(t)}${note ? ' — “' + note + '”' : ''}`);
  save(); closeSheet(); render();
}

/* ---------- pass-lock overlay ---------- */
function playPassLock(id) {
  const r = matchFor(id); if (!r) return;
  const m = S.m[id]; if (!m) return;
  const lay = $('#locklay');
  const meet = meetingPoint(S.trip.dir, r.fare.mode, areaById(r.t.area)?.meet || '');
  const fareFrom = r.fare.mode === 'train' ? `FLYTOGET · ${r.fare.each} KR EACH` : `${r.fare.solo} KR SOLO`;
  lay.innerHTML = `
    <div class="lock-stage">
      <div class="lock-kicker">MUTUAL · ROUTE CLEARED</div>
      <div style="position:relative">
        <div class="lockpass yours">
          <span class="lp-k">WINGMAN · YOUR PASS</span>
          <h4>${esc(S.trip.name)}</h4>
          <span class="lp-m">${esc(S.trip.flightNo)} · ${S.trip.dir === 'arriving' ? 'OSL → ' : '→ OSL · '}${esc(S.trip.areaLabel).toUpperCase()}</span>
        </div>
        <div class="stitchwrap"><div class="stitch"></div></div>
        <div class="lockpass theirs" style="margin-top:0">
          <span class="lp-k">WINGMAN · THEIR PASS</span>
          <h4>${esc(r.t.name)}</h4>
          <span class="lp-m">${esc(r.flight.no)} · NEAR ${esc(areaById(r.t.area).label.toUpperCase())} · ${r.distM} M FROM YOU</span>
        </div>
        <div class="lock-stampzone" id="lock-stampzone"></div>
      </div>
      <div class="lock-fare"><div class="board-row" style="justify-content:center">
        <div class="flap big" id="lock-fare-flap"></div></div></div>
      <div class="lock-meet">MEET · ${esc(meet.toUpperCase())} · ${r.handoff.from}–${r.handoff.to}</div>
    </div>
    <div class="lock-actions">
      <button class="btn btn-blush full" data-action="lock-continue" data-id="${id}">Open the shared plan</button>
      <div class="gap8"></div>
      <p class="smallnote center" style="color:var(--text-dim)">Now shared: first names, photos, this meeting point. Still private: addresses, numbers, everything else.</p>
    </div>`;
  lay.classList.remove('in', 'stitched', 'fared', 'met', 'done');
  lay.classList.add('show');
  const fareEl = $('#lock-fare-flap');
  later(() => lay.classList.add('in'), 80);
  later(() => lay.classList.add('stitched'), 900);
  later(() => { $('#lock-stampzone').innerHTML = '<span class="stamp blush pop" style="font-size:13px; padding:7px 13px; background:rgba(244,239,230,.92)">CLEARED FOR SHARED RIDE</span>'; }, 1500);
  later(() => { lay.classList.add('fared'); flapTo(fareEl, fareFrom); }, 2000);
  if (r.fare.mode !== 'train') later(() => flapTo(fareEl, `${r.fare.each} KR EACH`), 3000);
  later(() => lay.classList.add('met'), 3400);
  later(() => lay.classList.add('done'), 3800);
}

function lockContinue(id) {
  if (S.m[id]) { S.m[id].lockSeen = true; save(); }
  $('#locklay').classList.remove('show');
  location.hash = '#/match/' + id;
  render();
}

/* ---------- verification (mocked BankID / social) ---------- */
function openVerify(pendingId) {
  const pj = pendingId ? ` data-id="${pendingId}"` : '';
  $('#modal').innerHTML = `<div class="modal-inner">
    <div class="h2row" style="margin-top:0"><h2 class="disp">Verify it's you</h2><span class="mono-cap">ONCE · COVERS EVERY TRIP</span></div>
    <p class="smallnote">Nobody joins a stranger's route anonymously. Verify with BankID or connect a profile —
      other travellers see the badge, never the account. All of it is mocked in this prototype.</p>
    <div class="gap14"></div>
    <div class="vcard" style="border:none; padding:0; background:none">
      <div class="vc-grid">
        <button class="vbtn primary" data-action="verify-run" data-m="bankid"${pj}>Verify with BankID</button>
        <button class="vbtn" data-action="verify-run" data-m="linkedin"${pj}><span class="dot"></span>LinkedIn</button>
        <button class="vbtn" data-action="verify-run" data-m="instagram"${pj}><span class="dot"></span>Instagram</button>
        <button class="vbtn" data-action="verify-run" data-m="facebook"${pj}><span class="dot"></span>Facebook</button>
      </div>
    </div>
    <div class="gap14"></div>
    <button class="btn btn-ghost full sm" data-action="modal-close">Not now</button>
  </div>`;
  $('#modal').classList.add('show');
}

function runVerify(method, pendingId) {
  const label = VERIFY_LABEL[method] || 'ID';
  const pj = pendingId ? ` data-id="${pendingId}"` : '';
  $('#modal').innerHTML = `<div class="modal-inner">
    <div class="h2row" style="margin-top:0"><h2 class="disp">${esc(label)}</h2><span class="mono-cap">MOCKED — NOTHING REAL HAPPENS</span></div>
    <div class="board"><div class="board-row"><span class="board-label">ID</span><div class="flap" id="verify-flap"></div></div></div>
    <div class="gap14"></div>
    <div id="verify-actions"></div>
  </div>`;
  $('#modal').classList.add('show');
  const fl = $('#verify-flap');
  const steps = method === 'bankid'
    ? ['CONTACTING BANKID…', 'CONFIRM IN YOUR BANKID APP', 'IDENTITY VERIFIED ✓']
    : [`CONNECTING TO ${label.toUpperCase()}…`, 'PROFILE CONNECTED ✓'];
  flapTo(fl, steps[0]);
  steps.slice(1).forEach((s, i) => later(() => flapTo(fl, s), 1300 * (i + 1)));
  later(() => {
    S.verify = { method, atHM: simHM() };
    logEvent(`Identity verified via ${label}`);
    save();
    $('#verify-actions').innerHTML =
      `<button class="btn btn-amber full" data-action="verify-done"${pj}>${pendingId ? 'Continue to join' : 'Done'}</button>`;
  }, 1300 * steps.length);
}

/* ---------- gate check ---------- */
let gcTicks = [false, false, false];
function openGate(id) {
  const r = matchFor(id); if (!r) return;
  gcTicks = [false, false, false];
  const meet = meetingPoint(S.trip.dir, r.fare.mode, areaById(r.t.area)?.meet || '');
  $('#modal').innerHTML = `<div class="modal-inner">
    <div class="h2row" style="margin-top:0"><h2 class="disp">Gate Check</h2><span class="mono-cap">BOTH SIDES CONFIRM</span></div>
    <p class="smallnote">Three facts, out loud, before anyone stands at a kerb. ${esc(r.t.name)} does the same on their side.</p>
    <div class="gap8"></div>
    <div class="gc-row" data-action="gc-tick" data-i="0"><div class="gc-l">${r.fare.mode === 'train' ? 'Flytoget together' : 'Shared cab'}<small>TRANSPORT MODE</small></div><div class="gc-tick">✓</div></div>
    <div class="gc-row" data-action="gc-tick" data-i="1"><div class="gc-l">${r.fare.mode === 'train' ? r.fare.each + ' kr each, own tickets' : '≈ ' + r.fare.each + ' kr each, split at the kerb'}<small>FARE EXPECTATION</small></div><div class="gc-tick">✓</div></div>
    <div class="gc-row" data-action="gc-tick" data-i="2"><div class="gc-l">${esc(meet)} · ${r.handoff.from}–${r.handoff.to}<small>HANDOFF WINDOW</small></div><div class="gc-tick">✓</div></div>
    <div class="gap8"></div>
    <button class="btn btn-amber full" id="gc-confirm" data-action="gate-confirm" data-id="${id}" disabled>Confirm gate check</button>
    <div class="gap8"></div>
    <button class="btn btn-ghost full sm" data-action="modal-close">Not yet</button>
  </div>`;
  $('#modal').classList.add('show');
}
function gcTick(i) {
  gcTicks[i] = !gcTicks[i];
  $$('.gc-row').forEach((row, j) => row.classList.toggle('ok', gcTicks[j]));
  $('#gc-confirm').disabled = !gcTicks.every(Boolean);
}
function gateConfirm(id) {
  const m = S.m[id]; if (!m) return;
  m.st = 'gate_user'; m.gateReal = Date.now();
  logEvent('You completed Gate Check — waiting for ' + travellerById(id).name);
  save(); $('#modal').classList.remove('show'); render();
}

/* ---------- chat ---------- */
function sendChat(id, txt) {
  txt = (txt || '').trim(); if (!txt) return;
  const m = S.m[id]; if (!m) return;
  m.chat = m.chat || [];
  m.chat.push({ who: 'me', txt, t: simHM() });
  m.pendingReplyAt = Date.now() + 2200 + Math.floor((m.chat.length * 733) % 1600);
  save(); render();
}

/* ---------- /trips : the passport ---------- */
function viewTrips() {
  const past = `<div class="trippage settle d2">
    <div class="tp-route">OSL → Bislett</div>
    <div class="tp-meta">2 AUG · SK268 · WITH JONAS R. · SAVED 374 KR</div>
    <div class="tp-stamp"><span class="stamp ok">ARRIVED</span></div>
    <div class="timeline">
      <div class="tl-item"><span class="t">21:40</span>Cleared with Jonas R.</div>
      <div class="tl-item"><span class="t">22:04</span>Gate Check complete</div>
      <div class="tl-item"><span class="t">22:31</span>Shared cab from Exit B · arrived</div>
    </div>
  </div>`;
  if (!S.trip) {
    return `<div class="h2row"><h2 class="disp">My trips</h2><span class="mono-cap">PASSPORT</span></div>
      <div class="sign"><span class="arr">→</span> NO ACTIVE TRIP</div>
      <div class="gap14"></div>
      <button class="btn btn-amber full" data-action="dir-set" data-dir="arriving">Enter a flight</button>
      <div class="h2row"><h2 class="disp">Stamped</h2><span class="mono-cap">PAST</span></div>
      ${past}${footerHTML()}`;
  }
  const states = Object.entries(S.m).map(([id, m]) => ({ id, ...m }));
  const status = states.some(s => s.st === 'boarding') ? ['BOARDING TOGETHER', 'ok']
    : states.some(s => s.st === 'gate_user') ? ['GATE CHECK', '']
    : states.some(s => s.st === 'cleared') ? ['CLEARED', 'blush']
    : ['SEARCHING', 'ink'];
  const rows = states.filter(s => s.st !== 'ended').map(s => {
    const t = travellerById(s.id);
    return `<a href="#/match/${s.id}" style="display:flex; justify-content:space-between; align-items:center; padding:9px 0; border-bottom:1px dashed var(--line); color:var(--text)">
      <span style="font-size:13px">${esc(publicName(t))}</span>${stateChip(s.id)}</a>`;
  }).join('');
  const tl = S.log.slice(-8).map(e => `<div class="tl-item"><span class="t">${esc(e.t)}</span>${esc(e.txt)}</div>`).join('');
  return `
  <div class="h2row"><h2 class="disp">My trips</h2><span class="mono-cap">PASSPORT</span></div>
  <div class="trippage settle">
    <div class="tp-route">${S.trip.dir === 'arriving' ? 'OSL → ' + esc(S.trip.areaLabel) : esc(S.trip.areaLabel) + ' → OSL'}</div>
    <div class="tp-meta">TONIGHT · ${esc(S.trip.flightNo)} · ${S.trip.dir === 'arriving' ? 'LANDS' : 'DEPARTS'} ${esc(S.trip.timeLabel)} · ±${S.trip.flex} MIN</div>
    ${S.verify ? `<div style="margin-top:9px"><span class="vchip dark">✓ ${VERIFY_LABEL[S.verify.method]}</span></div>` : ''}
    <div class="tp-stamp"><span class="stamp ${status[1]}">${status[0]}</span></div>
    ${rows ? `<div class="gap14"></div>${rows}` : ''}
    ${tl ? `<div class="timeline">${tl}</div>` : ''}
    <div class="gap14"></div>
    <div style="display:flex; gap:8px">
      <a class="btn btn-ghost sm" style="flex:1" href="#/matches">Open the board</a>
      <button class="btn btn-ghost sm" data-action="end-trip">No longer looking</button>
    </div>
  </div>
  <div class="h2row"><h2 class="disp">Stamped</h2><span class="mono-cap">PAST</span></div>
  ${past}${footerHTML()}`;
}

/* ---------- global event wiring ---------- */
function closeSheet() { const sh = $('#sheet'); if (sh) sh.classList.remove('open'); }

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action, id = el.dataset.id;
  const t = travellerById(id);
  switch (a) {
    case 'dir-set': initDraft(el.dataset.dir); location.hash = '#/trip'; break;
    case 'set-dir': draft.dir = el.dataset.dir; draft.flightNo = null; render(); break;
    case 'pick-flight': draft.flightNo = el.dataset.no; render(); break;
    case 'demo-flight': draft.flightNo = draft.dir === 'arriving' ? 'DY1305' : 'DY1309'; render(); break;
    case 'use-parse': draft.dir = 'arriving'; draft.flightNo = 'DY1305'; draft.parsed = null; render(); break;
    case 'set-mode': draft.mode = el.dataset.v; render(); break;
    case 'set-open': draft.open = el.dataset.v; render(); break;
    case 'set-vis': draft.visibleTo = el.dataset.v; render(); break;
    case 'set-gender': draft.gender = el.dataset.v || null; render(); break;
    case 'toggle-vibe': {
      const v = el.dataset.v;
      draft.vibes = draft.vibes.includes(v) ? draft.vibes.filter(x => x !== v) : [...draft.vibes, v];
      render(); break;
    }
    case 'submit-trip': submitTrip(); break;
    case 'set-view': matchView = el.dataset.v; render(); break;
    case 'sheet-open': openSheet(id); break;
    case 'sheet-close': closeSheet(); break;
    case 'widen': S.trip.flex = 120; save(); logEvent('Window widened to ±120 min'); render(); break;
    case 'join-open':
      if (!S.verify) { openVerify(id); break; }
      openJoinTemplates(id); break;
    case 'verify-open': openVerify(el.dataset.id || null); break;
    case 'verify-run': runVerify(el.dataset.m, el.dataset.id || null); break;
    case 'verify-done': {
      $('#modal').classList.remove('show');
      const pj = el.dataset.id;
      render();
      if (pj && currentRoute().name === 'match') later(() => openJoinTemplates(pj), 60);
      break;
    }
    case 'join': doJoin(id, el.dataset.note || ''); break;
    case 'pass':
      S.passed.push(id); logEvent(`Different route — ${publicName(t)} hidden`);
      save(); closeSheet();
      if (currentRoute().name === 'match') location.hash = '#/matches'; else render();
      break;
    case 'plans': {
      if (S.m[id]) { S.m[id].st = 'ended'; }
      logEvent(`Plans changed — your match with ${t ? publicName(t) : 'a traveller'} ended quietly`);
      save(); location.hash = '#/matches'; render(); break;
    }
    case 'gate-open': openGate(id); break;
    case 'gc-tick': gcTick(Number(el.dataset.i)); break;
    case 'gate-confirm': gateConfirm(id); break;
    case 'modal-close': $('#modal').classList.remove('show'); break;
    case 'quick': sendChat(id, el.dataset.q); break;
    case 'chat-send': sendChat(id, $('#chat-input')?.value); break;
    case 'lock-continue': lockContinue(id); break;
    case 'reset': resetDemo(); break;
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('.sig-group')) {
    e.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }
});

/* ---------- boot ---------- */
window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);
