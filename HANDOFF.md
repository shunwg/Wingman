# Wingman prototype — handoff notes

Cloud session (Cowork) build, handed off for local work in Claude Code.
Read this file first if you're picking this up fresh — it's written so a
new Claude Code session has everything it needs without re-deriving it.

## What this is

A client-only interactive prototype for **Wingman** — an airport ride-matching
app (pairs travellers landing/departing near the same time with overlapping
last-mile destinations, so they can split a cab or ride the train together).
Set in Oslo / OSL Gardermoen, seeded data only, no backend.

Two documents matter before touching code:
- `docs/design-plan.md` — the design brief this build follows: the ten
  design-brief answers (unforgettable interaction, privacy ladder, empty
  state, banned motifs, etc.), the visual system, and the screen-by-screen
  spec. Treat it as the source of truth for *why* things look and behave
  as they do.
- This file — the *current build state*, file map, and how to keep working.

## Current state (v2)

- All 5 screens built and working: landing (`/`), trip form (`/trip`),
  matches/"the board" (`/matches`, convergence map + list toggle), match
  detail (`/matches/:id`), trips/"passport" (`/trips`).
- Matching engine (`src/matching.js`) is pure JS, unit-tested
  (`build/test-matching.js`): haversine distance, both-direction time
  windows, mode compatibility, and now a **two-way privacy filter**.
- v2 additions on top of the first pass:
  - **Distance ruler** — every traveller card/pass shows a 0–1km track with
    a marker at their actual metres-apart, not just a number.
  - **Per-person privacy** — each seeded traveller has `visibleTo`
    (`everyone` / `verified` / `women` / `men`); the user sets their own
    `visibleTo` + `gender` on the trip form. Matching is filtered both ways
    (`theyShowOK` / `userShowOK` in `matching.js`) and the board says so
    honestly ("2 on your route, hidden by their privacy choices").
  - **Mock identity verification** — BankID or LinkedIn/Instagram/Facebook
    connect, gates joining a route, reveals verified-only travellers.
    Fully mocked (`runVerify()` in `views2.js` — flap-board choreography,
    no real network call).
  - Full visual redesign: layered low-alpha strokes instead of hard
    borders, film grain, tactile press states, sentence-case UI copy with
    mono reserved for flight/time/money data (kept the split-flap flight
    formatting — don't touch that, it's the signature element).
- `wingman.html` at the project root is the **assembled, deliverable**
  single-file prototype (open directly in a browser, no server needed).
  It's generated — don't hand-edit it, edit `src/*` and rebuild.

## File map

```
src/
  data.js       seeded fixtures: AREAS (Oslo neighbourhoods w/ real coords),
                FLIGHTS (tonight's arrival/departure bank), TRAVELLERS (30
                fictional people incl. verify/visibleTo/gender/hue/line),
                RECENT_MATCHES, SIGNAL_REPLIES
  matching.js   pure functions: haversine, time-window, mode, privacy
                (theyShowOK/userShowOK/privacyHidden), scoring, fare maths,
                handoff window, meeting point. No DOM — runs under node.
  core.js       app shell: localStorage store, simulated clock, split-flap
                text engine, avatar SVGs, verification helpers, route
                receipt HTML, router scaffold, the tick loop (reciprocation,
                gate-check timers, chat replies)
  map.js        the convergence map: stylised SVG Oslo grid, runway node,
                1km ring, signal placement + radial label layout, route
                sketch for match detail
  views1.js     landing (/) + trip form (/trip) views
  views2.js     matches board, match detail, trips/passport, Pass-Lock
                overlay, Gate Check modal, verification modal, Signals
                chat, and the single delegated click-event handler
  styles.css    design tokens + full visual system (v2)
  shell.html    the HTML shell that build/assemble.js inlines CSS/JS into

build/
  assemble.js   concatenates src/*.js + styles.css into shell.html →
                writes wingman.html at project root. Run after ANY src/
                change.
  test-matching.js  node-runnable unit tests for matching.js (no browser)
  shoot.js      Playwright script: full click-through + screenshots of
                every screen and state transition, written to build/*.png
  *.png         reference screenshots from the last verified run

docs/
  design-plan.md   the design brief (see above)
```

## How to keep working

```bash
npm install                # only needed for build/shoot.js (Playwright)
npm test                   # run the matching-engine unit tests
npm run build               # rebuild wingman.html from src/
npm run dev                 # build + serve wingman.html on localhost:4173
npm run shoot                # full Playwright click-through + screenshots
                              # (requires a Chromium; see note below)
```

If Playwright's bundled Chromium isn't installed locally, either run
`npx playwright install chromium` once, or just open `wingman.html`
directly in a real browser and click through manually — the app has no
server dependency.

**Every edit to `src/*` needs `npm run build` before `wingman.html`
reflects it.** The two most common mistakes when picking this back up:
editing `wingman.html` directly (it gets overwritten), or forgetting to
rebuild before testing in a browser.

## Where this goes next

The prototype is intentionally structured so it maps 1:1 onto a real
TanStack Start app later (see the brief's "Technical notes"):
`src/data.js` → `src/data/*`, `src/matching.js` → `src/lib/matching.ts`
(already unit-testable, just needs types), `views1.js`/`views2.js` split
into real routes (`index`, `trip`, `matches`, `matches.$id`, `trips`) each
with their own `head()`, `core.js`'s store becomes a small hook +
`useEffect` hydration. None of that conversion has been started — this is
still the single-file client-only prototype.

Known gaps / things a next session might reasonably tackle:
- No real TanStack Start scaffold yet (see above).
- Verification, ticket parsing, and flight data are all mocked by design —
  don't accidentally "fix" these into real integrations without checking
  with the user first (the brief explicitly excludes them from this phase).
- Accessibility has had one pass (focus states, `prefers-reduced-motion`,
  list view as an alternative to the map, ARIA labels on the map signals)
  but hasn't had a dedicated audit — `design:accessibility-review` would
  be a good next step if the user wants to harden it.
