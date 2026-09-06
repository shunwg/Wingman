# Wingman v6 — premium, iOS-native UX on the existing product

**Status:** approved 2026-09-07. Companion plan: `docs/superpowers/plans/2026-09-07-v6-premium-ux.md`.

## Why

The product's engines are finished and honest; the interface still reads as a database. `#/` is a filter bar above eighteen full-height cards. There is no home, no journey, no moment of serendipity, no way to move a match to a meeting inside the chat. The brief (`docs/reviews/2026-09-07-ux-brief.md`) asks for one thing: *make the product concept feel inevitable* — tell Wingman where you're going, it finds the person, tells you why, you say hello, you meet.

## Decisions (user)

- System font stack; Fraunces and the webfont link go.
- Navy ink, one restrained Wingman blue accent, muted green and amber; guardian indigo folds into the blue family.
- Five tabs stay: **Home · Trips · Inbox · Circles · You**. Home absorbs Discover; the full board lives at `#/discover` behind "See all".
- The two-routes mark stays (airplane remains a banned motif).
- Push v5, build v6 on it, run the three personas on the finished screens.

## Target device

iPhone 17 Pro, portrait: **402 × 874 CSS px**, safe areas top 59 / bottom 34. The frame, screenshots and e2e all use this. Nothing is `min-height: 100dvh` except the shell.

## Architecture

Unchanged. Screens read selectors; selectors read the store; the engines stay pure. New code:

- `src/state/selectors/home.ts` — `useNextTrip()`, `useTopMatch(tripId)`, `useDestinationEvents(trip)`.
- `src/screens/home/` — `HomeScreen`, `NextJourneyCard`, `TopMatchCard`, `MomentSheet`, `DestinationEvents`.
- `src/lib/ics.ts` — `buildIcs(event)` beside `vcard.ts`.
- `src/domain/channel.ts` — `MessageBody` gains `{ kind: 'proposal'; meetKind; window; placeLabel }`.
- `src/design/patterns/Timeline.tsx` — the trip rail.

## Screens

**Home** — greeting + avatar (→ You). *Your next journey* (next open trip by `tripStart`; route chain; dates; status). *People worth meeting*: the `mostCompatible` candidate for that trip as one card with receipt lines and **Say hello**; "See all" → `#/discover`. *Upcoming at your destination*: live conference circles whose `venue.cityKey` matches a stay. The waiting-request strip when present. **The moment**: first visit when a stable pick exists — "Your paths cross in {city}. {Name} lands {time}. You have {n} together." Say hello / Not now. Once per pick (module-level one-shot, like `arrive.ts`).

**Person** — photo band (5:3, restrained), name ✓ stamps, title · company at the rung the ladder allows, "Why meet?" from the receipt, interest tags, Verified list, About, **Say hello** → sheet with kinds + opener + custom line → `sendRequest`. "Send request" is renamed everywhere, tests included.

**Chat (meet)** — presence, stages, guardian and contact stay. New **Suggest a time**: pick a proposable kind, a window preset inside the overlap, a public place label → posts a `proposal` message, rendered as a card with **Add to calendar** (ICS download) and **Propose another time**.

**Trips** — each trip is a vertical rail: airport code + local time · flight · layover (usable minutes, "people nearby" bucketed) · airport · stay with events at the destination. Edit / Hide / Remove stay.

**Discover** (`#/discover`) — lens row *For you · Same flight · Same airport · Same event* mapping to overlap kinds; cards lead with who / why / why now; density and the finer filters below. No swipe.

**Circles / Events** — restyled; events surface on Home and Trips.

**You** — header stats (trips · people met · events · circles), Verified list, the existing privacy sections restyled.

## Not doing

Push notifications; a plane mark; extra tabs; a general messenger; followers/likes/scores.

## Contracts

Every e2e spec and persona flow keeps passing, with strings updated in lockstep: `Around you` → Home title; `Send request` → `Say hello`; tab labels; `dead-ends.spec.ts` gains `#/discover`. Rule 3: `ContextStrip` and event member counts go through `bucket()`.
