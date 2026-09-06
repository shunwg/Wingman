# Wingman v6 — premium UX, implementation plan

> Spec: `docs/superpowers/specs/2026-09-07-v6-premium-ux-design.md`. Brief: `docs/reviews/2026-09-07-ux-brief.md`. Branch `wingman-v6` on top of `wingman-v5`. Every stream ends with `npm run verify`, `npm run lint`, `npm run e2e` green and a commit. TDD for every new selector, lib and domain function.

## Streams

| # | Brief phase | Stream | Exit |
|---|---|---|---|
| 1 | 2 | System: tokens, fonts, frame, safe areas, metas, viewports | Both themes shoot at 402×874; no webfont request; literals gone from `screens.css` |
| 2 | 3 | Home: selectors (`useNextTrip`, `useTopMatch`, `useDestinationEvents`), `HomeScreen`, the moment; board moves to `#/discover` | `#/` shows greeting · next journey · one person · destination events; e2e updated |
| 3 | 3 | Person: restrained band, "Why meet?", Verified list, **Say hello** sheet | `discover.spec.ts` green with the new label |
| 4 | 3 | Meeting: `proposal` message body, `lib/ics.ts`, Suggest a time, calendar card | `inbox.spec.ts` green; a proposal round-trips through the store |
| 5 | 4 | Trips: `Timeline` pattern, per-stop people (bucketed) and events | `add-trip.spec.ts` green |
| 6 | 5 | Discover: lens row For you · Same flight · Same airport · Same event | `discover.spec.ts` green |
| 7 | 6–7 | Circles/Events restyle; You header stats + Verified list; rule-3 fixes | `organiser.spec.ts`, `bankid.desktop.spec.ts` green |
| 8 | 8 | Polish: transitions, press states, copy audit, both themes; personas run + roll-up (closes v5) | reports + ROLLUP; STATUS/README; merge to main |

## Stream 1 — System

- `src/design/tokens/tokens.css`: navy ink, blue accent family, muted green/amber, guardian → blue family, warm canvas; system font stack; `--scrim`, `--on-photo`, `--shadow-raise`; radii card 16 / md 12 / sm 8; type scale 3xl 2.125rem. Dark values regenerated in both blocks from one table (`scripts/design/tokens.py` not needed — edit both).
- `screens.css` 1–115: frame 402, header `calc(env(safe-area-inset-top) + 12px) 20px 8px`, main `0 20px` + bottom `calc(64px + inset)`, tab bar 49pt. Replace the 10 literals with tokens.
- `index.html`: drop the Google Fonts link + preconnects; `apple-mobile-web-app-capable`, `-status-bar-style: default`, `-title`; theme-colors to the new canvas.
- `playwright.config.ts` + `scripts/shoot.ts`: 402×874, DPR 3, iPhone UA.
- `CLAUDE.md` design-system section updated.

## Stream 2 — Home

- `src/state/selectors/home.ts`: `useNextTrip()` (open trips sorted by `tripStart`, first), `useTopMatch(tripId)` (the `mostCompatible` candidate from `useBoard()` for that trip, else the top-scored), `useDestinationEvents(trip)` (live conference circles whose `venue.cityKey` ∈ trip stays' `cityKey`). Tests in `home.test.ts`.
- `src/screens/home/HomeScreen.tsx` + `NextJourneyCard`, `TopMatchCard`, `DestinationEvents`, `MomentSheet`, `moment.ts` (one-shot per person id).
- Routes: `#/` → home (`route.name: 'home'`), `#/discover` → board; TabBar first tab Home (Compass → new `Home` icon). `smoke.spec.ts`, `dead-ends.spec.ts`, `first-run.spec.ts`, `demo.spec.ts`, flows 02/04 updated (heading `Around you` stays on the board; Home heading is the greeting).

## Stream 3 — Person

- `PersonScreen`: band 5:3 → 4:3 capped 220px; name + ✓; title · company; "Why meet?" receipt; tags; Verified; About; **Say hello** → `HelloSheet` (kinds, openers, custom line) → `sendRequest`. Rename `Send request` → `Say hello` in `discover.spec.ts`, flow 04.

## Stream 4 — Meeting

- `domain/channel.ts`: `{ kind: 'proposal'; meetKind; window: TimeWindow; placeLabel: string }`.
- `lib/ics.ts`: `buildIcs({ title, start, end, location, description })` — RFC 5545, CRLF, UID from ids. Test.
- Store: `post()` accepts it (already generic). `ChannelScreen`: **Suggest a time** → `ProposeSheet` (kind from `proposableKinds` of the request, window presets inside `request.proposal.window`/overlap, place label) → posts. Message card renders **Add to calendar** (download) and **Propose another time**.

## Stream 5 — Trips

- `design/patterns/Timeline.tsx` (pure presentational). `TripsScreen` renders each trip as a rail: stop (IATA, city, local time, terminal) · flight leg · layover (usable min + `bucketPhrase(context.inYourLayover)`) · stay (city, dates, destination events). Actions unchanged.

## Stream 6 — Discover

- `BoardFilters`: new first row `lens` chips For you · Same flight · Same airport · Same event → `BoardFilters.lens: 'all'|'same_flight'|'same_airport'|'same_event'` applied in `applyBoardFilters` on `overlap.kind` / event membership. Card: who / why / why-now ordering.

## Stream 7 — Circles, Events, You

- Restyle `circlecard`/`circlerow`; `YouScreen` header with stats (`myTrips.length`, `reputation.meetsCompleted`, events = conference memberships, circles) and Verified list from the stamp registry display. `ContextStrip` and `event.ts` member count → `bucket()`.

## Stream 8 — Polish and personas

- Transitions (screen enter 180ms opacity+8px), timeline reveal, press states on new controls, copy audit (no Connect/Follow/Submit), `SHOOT_DARK=1` review at 402.
- Run `npm run personas:flows`, dispatch three persona subagents, write `testing/reports/<date>/*.md`, `ROLLUP.md`, `docs/reviews/2026-09-07-personas.md`; fix P0s; STATUS/README; merge.
