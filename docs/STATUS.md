# Where the build is

Branch `main`, deployed to https://shunwg.github.io/Wingman/ on every push. `npm run verify`
is green (typecheck · purity gate · boundaries · dataset · 328 tests · 14 Playwright flows). CI runs `verify`,
`lint`, `build` and `e2e` before anything is published.

Plan: `docs/superpowers/plans/2026-09-05-wingman-v4.md` (also the source for every per-stream plan).
Feedback and the iteration log: `docs/reviews/2026-09-05-feedback.md`.
House rules and skill routing: `CLAUDE.md`.

## Done

| Phase | What landed |
|---|---|
| 0–2 | Vite/React/TS scaffold, `domain/` contract, 3,270 airports with derived zones, the privacy and matching engines (pure, property-tested), the design system and procedural portraits |
| 3–4 | The store with a versioned migration chain, the meet-request FSM, and a clickable app: Discover · Trip · Inbox · Circles · You |
| v3 | Real portraits for the seed cast, five-tab shell, Circles as a place, stamps (BankID, LinkedIn, Google, Meta, work email — mocked behind one seam), multi-trip boards, trip colours, meet rooms with terminals derived from the flight, circle invites, the deployment memo |

## v4 streams

| # | Stream | State |
|---|---|---|
| 0 | Repo hygiene, one alias source, e2e scaffold, CI gate, feedback file | ☑ |
| 1 | Brand: logo, favicon, icons, manifest, Route glyph | ☐ |
| 2 | Onboarding, registration, BankID-first verify, first trip, profile edit | ☑ |
| 3 | Circles: admission by list or domain, logo, badges, roles | ☑ |
| 4 | Inbox: safety surfaces, then meet / circle / group chat in one list | ☑ |
| 5 | Trips: add / edit / connections / purpose / bundled lookup | ☑ |
| 6 | Events: organiser dashboard, QR, event board | ☑ |
| 7 | Discover density + professional depth | ☑ |
| 8 | Matching v2 | ☐ |
| 9 | The Jobs / Thiel loop + polish (gate: both ≥ 9.5/10) | ☐ |
| 10 | Wrap | ☐ |

## Known gaps (the S1 findings)


## Things a later session must not undo

- Screens and components take `RedactedPerson`, never `Person`.
- Never persist derived state — visibility is recomputed on read.
- Every count crossing into the UI goes through `lib/bucket.ts`.
- All writes to requests / meets / ratings go through `state/machines/`.
- The ranking score is ordering only and is never rendered.
- Colour is never the only indicator; airplane icons are a banned motif.

## Commands

```bash
npm run dev        # http://localhost:5173
npm run verify     # everything that must be green
npm run e2e        # Playwright flows
npm run shoot      # screenshots → docs/shots/ (dev server must be up)
```
