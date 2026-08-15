# Where the build is

Branch `wingman-v3`. Everything committed is green: `npm run verify` passes
(typecheck · purity gate · import boundaries · 148 tests, ~4s).

Plan: `C:\Users\ShunGong\.claude\plans\read-through-the-data-cozy-wand.md`
House rules and skill routing: `CLAUDE.md`

## Done

| Phase | What landed |
|---|---|
| 0 | Vite/React/TS scaffold, `domain/` contract, 3,270 worldwide airports with derived timezones, 96 metros grouped |
| 1 | `privacy/` and `matching/` — pure, no clock, no randomness, property-tested |
| 2 | `design/` tokens, primitives, procedural portraits, `/_design` gallery |
| 3 (part) | `state/machines/meetRequest.ts` — the request FSM incl. deny-after-send |

## Next, in order

1. **Rest of phase 3** — Zustand slices, idb-keyval persistence with a versioned
   migration chain from day one, `machines/meet.ts` and `machines/rating.ts`.
2. **Phase 4a** — `screens/_shell/` (AppShell, TabBar, routes), onboarding,
   profile, trips, flight search. Replace the stub router in `src/App.tsx`.
3. **Phase 4b** — board, person, request lifecycle incl. `DenySheet`, meets.
   Then delete `src/*.js`, `src/styles.css`, `src/shell.html`, `build/`,
   `wingman.html` — the v2 prototype, kept only for its seed fixtures.
4. **Phase 4c** — audience, preview-as, policy editor, guardian, ratings, circles.
5. **Phase 5** — `stamps/` (mocks first, then BankID + the three socials).
6. **Phase 6** — `providers/flights/`.
7. **Phase 7** — founder playthrough (7 scenarios → `docs/founder-review.md`),
   a11y pass, Playwright suite.

## Things a later session must not undo

- Screens and components take `RedactedPerson`, never `Person`.
- Never persist derived state — visibility is recomputed on read.
- Every count crossing into the UI goes through `lib/bucket.ts`.
- All writes to requests/meets/ratings go through `state/machines/`.
- The ranking score is ordering only and is never rendered.
- Seed data still to port from the v2 `src/data.js` before deleting it.

## Useful commands

```bash
npm run dev            # http://localhost:5173 — currently the gallery only
npm run test:pure      # engines, plain Node, ~4s
npm run verify         # everything
npx tsx scripts/shoot.ts   # screenshots → docs/shots/ (needs dev server up)
```

## Known gaps

- `src/App.tsx` is a stub router that sends every route to the gallery.
- No screens exist yet, so there is nothing to click through.
- `data/seed/` is empty; the board has no people to show until it is populated.
