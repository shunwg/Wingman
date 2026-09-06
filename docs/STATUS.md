# Where the build is

Branch `main`, deployed to https://shunwg.github.io/Wingman/ on every push. `npm run verify`
is green (typecheck · purity gate · boundaries · dataset · 388 tests · 16 Playwright flows · 6 persona flows). CI runs `verify`,
`lint`, `build` and `e2e` before anything is published.

Plans: `docs/superpowers/plans/2026-09-05-wingman-v4.md` (v4), `2026-09-05-wingman-v5.md` (matchmaking + personas), `2026-09-07-v6-premium-ux.md` (the premium UX).
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
| 1 | Brand: logo, favicon, icons, manifest, Route glyph | ☑ |
| 2 | Onboarding, registration, BankID-first verify, first trip, profile edit | ☑ |
| 3 | Circles: admission by list or domain, logo, badges, roles | ☑ |
| 4 | Inbox: safety surfaces, then meet / circle / group chat in one list | ☑ |
| 5 | Trips: add / edit / connections / purpose / bundled lookup | ☑ |
| 6 | Events: organiser dashboard, QR, event board | ☑ |
| 7 | Discover density + professional depth | ☑ |
| 8 | Matching v2: reciprocity from conduct, stable pick, scarcity / complementarity / cohort | ☑ |
| 9 | The Jobs / Thiel loop + polish (Jobs 9.55 · Thiel 9.5) | ☑ |
| 10 | Wrap: STATUS, README, media, memo appendix, deploy check | ☑ |

## v5 — matchmaking and personas

| # | Stream | State |
|---|---|---|
| 1 | The interest vocabulary: 96 tags, adjacency by hand, free text resolves in | ☑ |
| 2 | Two-sided fit: what I seek against what they offer, both ways; interests replace dead topics | ☑ |
| 3 | Who you want to meet: one preference, both halves, never a signal; order-preservation test | ☑ |
| 4 | The surfaces that collect interests, wants and the preference | ☑ |
| 5 | Store v5: nested backfill for existing profiles | ☑ |
| 6 | Six persona flows, screenshots named for state | ☑ |
| 7 | Three personas, the template, the runner prompt (banned/required verbatim) | ☑ |
| 8 | Persona run and roll-up — run on the v6 screens, see `docs/reviews/2026-09-07-personas.md` | ☑ |

## v6 — premium, iOS-native UX (7 Sep 2026)

| # | Stream | State |
|---|---|---|
| 1 | System: platform type, navy + one blue, 402×874 frame, safe areas, no webfont | ☑ |
| 2 | Home: greeting, next journey, the one person, the moment, events at the destination; board at `#/discover` | ☑ |
| 3 | Person: restrained band, Why meet?, Verified, Say hello in a sheet | ☑ |
| 4 | Meeting: Suggest a time → proposal card → Add to calendar (ICS) / Propose another time | ☑ |
| 5 | Trips: the timeline rail with people and events at each stop | ☑ |
| 6 | Discover: For you · Same flight · Same airport · Same event | ☑ |
| 7 | You: record row and a Verified list from the registry | ☑ |
| 8 | Polish: screen fade, both themes at 402; personas run and rolled up | ☑ |

## Known gaps

Every S1 finding from the review is closed. Deferred, with reasons in the feedback log:

- **C5** `AudienceRule.excludeDomains` ("hide me from my own firm"): a new one-directional privacy rule; needs its own property tests.
- **First-paint size**: the 465 KB city table (105 KB gz) ships with the entry; making the city picker and stay lookups load it on demand is a data-layout change.
- **Real providers**: BankID, OAuth and Supabase stay mocked behind their seams by design (`stamps/registry.ts`, `account.provider`). Wiring them is procurement, per the memo.

## Review scores

6 September 2026, round 2 (`docs/reviews/2026-09-05-feedback.md`): **Jobs 9.55 / 10 · Thiel 9.5 / 10.**
7 September 2026, persona roll-up: `docs/reviews/2026-09-07-personas.md`.
Curated evidence: `docs/media/` (eleven light screens, four dark), shot at 402×874.

## Things a later session must not undo

- Screens and components take `RedactedPerson`, never `Person`.
- Never persist derived state — visibility is recomputed on read.
- Every count crossing into the UI goes through `lib/bucket.ts`.
- All writes to requests / meets / ratings go through `state/machines/`.
- The ranking score is ordering only and is never rendered.
- Colour is never the only indicator; airplane icons are a banned motif.
- The platform font, one blue, an iPhone 17 Pro frame: `CLAUDE.md` § Design system. Nothing stretches to fill height.

## Commands

```bash
npm run dev        # http://localhost:5173
npm run verify     # everything that must be green
npm run e2e        # Playwright flows
npm run shoot      # screenshots → docs/shots/ (dev server must be up); SHOOT_DARK=1 for both themes, SHOOT_ALL=1 for every viewport
```
