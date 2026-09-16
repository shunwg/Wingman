# Shared cars + native consolidation — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans`. Design doc:
> `docs/superpowers/specs/2026-09-16-rideshare-consolidation-design.md`. Every stream ends
> with `npm run verify` green, `npm run lint` clean, and a commit.
> `superpowers:verification-before-completion` before any claim that a stream is done.

**Goal:** Creating and joining a shared airport car, in both directions, with three join
modes — plus the assets and interaction patterns worth keeping from `wingman-native`.

**Architecture:** New `Ride` domain object hanging off a `Trip`; `Meet.participants`
widened to `PersonId[]` behind a `makeMeet()` guard; ride audience expressed in the
existing `AudienceRule` vocabulary; the ride room is an existing `'group'` `Channel`.

**Tech stack:** Vite · React · TypeScript · Zustand · Vitest · Playwright.

**Branch:** `wingman-v8-rideshare` (off `wingman-v7`).

---

## Stream A — Assets (independent; may run first or in parallel)

**Files:** `src/assets/places/**` (new), `src/assets/places/PROVENANCE.md` (new),
`src/data/places.ts` (new).

- [ ] **A1.** Copy `../wingman-native/assets/photos/airports/{OSL,LHR,CPH,SIN,CDG}` and
  `../wingman-native/assets/photos/stock` into `src/assets/places/`, preserving the
  per-airport folder shape. ~40 files, ~2.4 MB. Do **not** copy `assets/people/` — the 16
  portraits are already byte-identical in this repo (verify with a hash comparison; if any
  differ, stop and report rather than overwriting).
- [ ] **A2.** Write `src/assets/places/PROVENANCE.md`: one row per file — filename,
  subject, source, licence. The native README states the place photography is licensed and
  the portraits are generated likenesses, but ships no per-file manifest. Any file whose
  source cannot be established from the native repo's git history gets a `source: unknown
  — flagged` row and is listed in a "needs confirmation" section at the top rather than
  silently presented as cleared.
- [ ] **A3.** Write `src/data/places.ts` — an `airportPhotos` / `stockPhotos` map of static
  `import`s, mirroring the native `photos.ts` shape so screens read
  `airportPhotos.CDG.fontainebleauChateau`. Vite resolves these at build time; no
  `require()`.
- [ ] **A4.** `npm run verify`, then commit: `assets: bring the native prototype's place
  photography across`.

## Stream B — Domain

**Files:** `src/domain/ids.ts`, `src/domain/ride.ts` (new), `src/domain/meet.ts`,
`src/domain/guards.ts`, `src/domain/index.ts`, `src/domain/ride.test.ts` (new),
`src/domain/guards.test.ts`.

- [ ] **B1.** `ids.ts`: add `export type RideId = Brand<string, 'RideId'>;` and
  `export const asRideId = (s: string) => s as RideId;` beside the existing ones.
- [ ] **B2.** Write the failing test `src/domain/ride.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { seatsLeft, rideIsJoinable } from './ride';
import { makeRide } from './ride';

const base = () =>
  makeRide({
    id: 'r1', hostPersonId: 'you', tripId: 't1',
    direction: 'from_airport', airportIata: 'CDG',
    point: { lat: 48.4084, lon: 2.7019, label: 'Fontainebleau' },
    window: { startUtc: '2026-09-19T14:00:00Z', endUtc: '2026-09-19T15:00:00Z' },
    seatsTotal: 4, audience: { kind: 'open', rules: [] },
    createdAt: '2026-09-16T09:00:00Z',
  });

describe('seatsLeft', () => {
  it('counts the host against the total', () => {
    expect(seatsLeft(base())).toBe(3);
  });
  it('ignores declined and withdrawn claims', () => {
    const r = base();
    r.claims.push(
      { personId: 'a', status: 'confirmed', askedAt: '2026-09-16T10:00:00Z', history: [] },
      { personId: 'b', status: 'declined', askedAt: '2026-09-16T10:00:00Z', history: [] },
      { personId: 'c', status: 'withdrawn', askedAt: '2026-09-16T10:00:00Z', history: [] },
    );
    expect(seatsLeft(r)).toBe(2);
  });
  it('never goes negative', () => {
    const r = base();
    r.seatsTotal = 1;
    r.claims.push({ personId: 'a', status: 'confirmed', askedAt: '2026-09-16T10:00:00Z', history: [] });
    expect(seatsLeft(r)).toBe(0);
  });
});

describe('rideIsJoinable', () => {
  it('is false once the seats are gone', () => {
    const r = base();
    r.seatsTotal = 1;
    expect(rideIsJoinable(r, '2026-09-16T10:00:00Z')).toBe(false);
  });
  it('is false after the pickup window has passed', () => {
    expect(rideIsJoinable(base(), '2026-09-20T00:00:00Z')).toBe(false);
  });
  it('is true while open, seated and in time', () => {
    expect(rideIsJoinable(base(), '2026-09-16T10:00:00Z')).toBe(true);
  });
});
```

- [ ] **B3.** Run `npx vitest run src/domain/ride.test.ts` — expect failure, module not
  found.
- [ ] **B4.** Write `src/domain/ride.ts` exactly as specified in the design doc: the types
  `RideDirection`, `RidePoint`, `RideAudience`, `RideClaimStatus`, `RideClaim`, `RideEvent`,
  `RideStatus`, `Ride`; a `makeRide()` constructor that seeds `claims: []`, `history: []`,
  `status: 'open'` and derives `expiresAt` from `window.endUtc`; and the two pure helpers:

```ts
/** Seats still available. The host occupies one; only live claims consume the rest. */
export function seatsLeft(r: Ride): number {
  const taken = r.claims.filter((c) => c.status === 'requested' || c.status === 'confirmed').length;
  return Math.max(0, r.seatsTotal - 1 - taken);
}
```

  There is no `full` status — "full" is `seatsLeft(r) === 0`, computed on read (rule 2).
- [ ] **B5.** Run the test — expect pass. Commit: `domain: a shared car is an n-person
  Ride hanging off a trip`.
- [ ] **B6.** Widen `Meet` in `src/domain/meet.ts`: `participants: PersonId[]`, and replace
  `fromRequestId: MeetRequestId` with
  `origin: { kind: 'request'; requestId: MeetRequestId } | { kind: 'ride'; rideId: RideId }`.
  Keep the existing doc comments; add one explaining that the pair invariant moved from the
  type to `makeMeet()`.
- [ ] **B7.** Write the failing test in `src/domain/guards.test.ts`:

```ts
it('refuses a three-person gate coffee', () => {
  expect(() =>
    makeMeet({
      id: 'm1', participants: ['a', 'b', 'c'], kind: 'gate_coffee',
      origin: { kind: 'request', requestId: 'q1' },
      place: makePublicPlace({ kind: 'gate', label: 'Gate C12' }),
      window: { startUtc: '2026-09-19T14:00:00Z', endUtc: '2026-09-19T15:00:00Z' },
    }),
  ).toThrow(/two people/i);
});

it('accepts a four-person ride share', () => {
  const m = makeMeet({
    id: 'm2', participants: ['a', 'b', 'c', 'd'], kind: 'ride_share',
    origin: { kind: 'ride', rideId: 'r1' },
    place: makePublicPlace({ kind: 'taxi_rank', label: 'Taxi rank, Terminal 2E' }),
    window: { startUtc: '2026-09-19T14:00:00Z', endUtc: '2026-09-19T15:00:00Z' },
  });
  expect(m.participants).toHaveLength(4);
});

it('refuses duplicate participants', () => {
  expect(() => makeMeet({ /* …participants: ['a', 'a'], kind: 'ride_share'… */ })).toThrow(/twice/i);
});
```

- [ ] **B8.** Run it — expect failure. Then add `makeMeet()` to `src/domain/guards.ts`
  alongside `makePublicPlace()`, with `PAIR_ONLY_KINDS` covering `gate_coffee`,
  `lounge_sit`, `dinner` and the other one-to-one kinds (read `ALL_MEET_KINDS` in
  `domain/intent.ts` and classify every member explicitly — no default, so a new kind
  forces a decision). Export it from `domain/index.ts`.
- [ ] **B9.** Run tests — expect pass. `npm run typecheck:pure` and `npm run lint` clean.
  Commit: `domain: a Meet can hold more than two people, behind a guard that says when`.

## Stream C — The seat FSM

**Files:** `src/state/machines/rideSeat.ts` (new), `src/state/machines/rideSeat.test.ts` (new).

- [ ] **C1.** Read `src/state/machines/meetRequest.ts` first and follow its table shape and
  error style exactly — this stream should look like it was written by the same hand.
- [ ] **C2.** Write the failing test: a legal path `requested → confirmed`, every illegal
  transition throwing (`confirmed → requested`, `declined → confirmed`,
  `withdrawn → confirmed`), and that each successful transition appends exactly one
  `history` entry carrying `from`, `to`, `at` and `by`.
- [ ] **C3.** Run it — expect failure. Implement `rideSeat.ts`: the transition table, a
  `transitionSeat()` that throws on an illegal move, and a `RIDE_TRANSITIONS` table for the
  ride's own lifecycle (`open → confirmed → departed → completed`, with `cancelled`
  reachable from anything not yet `completed`).
- [ ] **C4.** Run tests — expect pass. Commit: `state: seat claims move through an FSM that
  throws, like every other write`.

## Stream D — Privacy: who may see and join a ride

**Files:** `src/privacy/ride/audience.ts` (new), `src/privacy/ride/audience.test.ts` (new),
`src/privacy/index.ts`.

- [ ] **D1.** Read `src/privacy/presets.ts` and the `AudienceRule` type first; reuse them
  rather than defining a parallel filter type.
- [ ] **D2.** Write the failing test, covering: an `open` ride with no rules admits anyone;
  an `open` ride with a women-only rule denies a man and admits a woman; a `circles` ride
  admits a member and denies a non-member; **a `circles` ride with an empty `circleIds`
  list admits nobody** (the `f64b42d` lesson); an `invite` ride denies everyone without the
  code and admits the code-holder; and that every denial returns a reason whose text names
  no other person.
- [ ] **D3.** Run it — expect failure. Implement `evaluateRideAudience()` — pure, no React,
  no DOM, and no import from `matching/` (the boundary is enforced by
  `tsconfig.pure.json` and ESLint, so a violation is a type error, not a review comment).
- [ ] **D4.** Export it from `privacy/index.ts`. Run `npm run test:pure`,
  `npm run typecheck:pure`, `npm run lint`. Commit: `privacy: a ride's audience speaks the
  same rule language as a profile's`.

## Stream E — Matching: which rides are going my way

**Files:** `src/matching/filters/rideFilters.ts` (new),
`src/matching/filters/rideFilters.test.ts` (new), `src/matching/index.ts`.

- [ ] **E1.** Find the haversine already used to compute `destinationKm` (grep
  `destinationKm` and follow it into `matching/`) and reuse it. Do not add a second
  distance function.
- [ ] **E2.** Write the failing test: same airport and overlapping window passes; a
  different airport fails; a non-overlapping window fails; a `to_airport` ride does not
  match someone travelling `from_airport`; a point 40 km away fails a 15 km radius and
  passes a 40 km one; and an unknown destination fails an explicit radius (matching
  `applyBoardFilters`'s existing, deliberate behaviour — "someone who has not said where
  they are going is not evidence that they are going your way").
- [ ] **E3.** Run it — expect failure. Implement `rideMatchesTraveller()` and
  `filterRides()`. Pure; no clock, no `Math.random()` (ESLint bans both here) — `now` is a
  parameter.
- [ ] **E4.** Export from `matching/index.ts`. `npm run test:pure` and `npm run lint`.
  Commit: `matching: rides filter on direction, airport, window and how far apart we end
  up`.

## Stream F — State and selectors

**Files:** `src/state/store.ts`, `src/state/selectors/rides.ts` (new),
`src/state/selectors/rides.test.ts` (new), `src/data/seed/rides.ts` (new).

- [ ] **F1.** Add a `rides: Ride[]` slice to the store with the actions `hostRide`,
  `claimSeat`, `confirmSeat`, `declineSeat`, `withdrawSeat`, `cancelRide`. Every one of
  them routes through `transitionSeat()` / the ride table — none mutates `status` directly.
  Bump the persisted-state version and add a migration that defaults `rides: []`, following
  the existing migration comments in `store.ts`.
- [ ] **F2.** `claimSeat` seats automatically when the audience is `circles` or `invite`,
  and creates a `requested` claim needing the host's confirmation when the audience is
  `open` — the decision recorded in the design doc. Put that rule in one place with a
  comment, not spread across call sites.
- [ ] **F3.** When a ride reaches two or more confirmed people, open its room via the
  existing `openGroup()` and post a system message naming the pickup window and point.
  Reuse `'group'`; do not add a `ChannelKind`.
- [ ] **F4.** Write `src/state/selectors/rides.ts`: `useRidesForBoard()` (rides the viewer
  may see and could join, computed on read — never stored), `useMyRides()`, and
  `useRideRoom()`. Hidden-ride counts go through `lib/bucket.ts`.
- [ ] **F5.** Seed two rides in `src/data/seed/rides.ts`: the flagship Fontainebleau car
  (CDG → Fontainebleau, INSEAD-circle audience, one seat left — the scenario the native
  prototype demonstrates) and one open airport-bound ride in another city so both
  directions are visible in the demo.
- [ ] **F6.** Tests for the selectors: a filtered-out viewer sees nothing, a circle member
  sees the Fontainebleau car, and claiming the last seat makes `seatsLeft` zero without
  writing a `full` status anywhere. `npm run verify`. Commit: `state: host, join and cancel
  a shared car`.

## Stream G — Surfaces

**Files:** `src/screens/trips/RideSheet.tsx` (new), `src/screens/trips/TripForm.tsx`,
`src/screens/trips/TripsScreen.tsx`, `src/design/patterns/RideCard.tsx` (new),
`src/screens/discover/BoardFilters.tsx`, `src/screens/discover/BoardScreen.tsx`,
`src/screens/rides/RideScreen.tsx` (new), `src/screens/inbox/ChannelScreen.tsx`,
`src/app/routes.tsx` (or wherever the hash routes live — grep `#/circle/` to find it),
`src/design/tokens/screens.css`.

- [ ] **G1.** `TripForm`: add the destination field beside the existing "Area" one — a
  label plus a coarse lat/lon resolved from the existing airport/city dataset, written to
  `StayWindow.destination`. This is the change that switches on the already-built
  within-5/15/40 km filter. Keep the "a neighbourhood, never an address" copy and the
  field-error wiring added in `2e31f7e`.
- [ ] **G2.** `RideSheet`: direction toggle (`to_airport` / `from_airport`), where, pickup
  window, seats, who can join (open + filters · a circle · invite link), fare split.
  Follow the existing `Field` / `AudienceRule` presets idiom; no literal colours (tokens
  only).
- [ ] **G3.** `RideCard` in `design/patterns/`: route rail, pickup time, seats left, who is
  in, split line. This is the port of the native Car screen's vocabulary. It takes
  `RedactedPerson`, never `Person` (rule 1).
- [ ] **G4.** Add a `shared_cars` lens to `BoardFilters`'s `LENSES` and render `RideCard`s
  for it in `BoardScreen`.
- [ ] **G5.** `RideScreen` at `#/ride/:id` — the ride's detail and claim action — and
  `#/ride/code/:code` for an invite link, mirroring the circle-invite route's structure and
  its "already a member / bad code / expired" states.
- [ ] **G6.** The split-cost strip in the ride room (`ChannelScreen` when the channel is a
  ride's): persistent, showing the per-person share as an estimate, worded so it is plainly
  an intention and not a charge.
- [ ] **G7.** `npm run verify`, `npm run lint`, `npm run e2e`. Commit: `screens: create a
  car for others to join, and join someone else's`.

## Stream H — Photography on the surfaces that were text-only

**Files:** `src/screens/trips/TripsScreen.tsx`, `src/screens/home/HomeScreen.tsx`,
`src/screens/circles/*`, `src/design/tokens/screens.css`.

- [ ] **H1.** Trip rows gain a place photograph keyed by airport code from
  `data/places.ts`, with the Welcome hero's existing scrim and `saturate(0.85)` treatment so
  new photography matches the restrained palette rather than introducing stock-photo colour.
- [ ] **H2.** Add the "Where you will be" port rail from the native Trips screen —
  horizontally scrolling `PortCard`s. wingman has no equivalent and it reads well.
- [ ] **H3.** Event / circle cards gain a venue photograph where one identifies the place.
  A photo earns its place if it is identifying or emotionally load-bearing, never
  decorative.
- [ ] **H4.** `SHOOT_DARK=1 npm run shoot`; review every affected screen in both themes.
  Commit: `design: photography on the trip, port and event surfaces`.

## Stream I — Verify and ship

- [ ] **I1.** New e2e specs in `e2e/`: host a ride → another persona's board shows it →
  join → the room appears; invite-link join; and a filtered-out viewer does **not** see the
  ride.
- [ ] **I2.** `npm run verify` · `npm run lint` · `npm run e2e` · `npm run personas:flows`
  — all green, output read, not assumed.
- [ ] **I3.** `SHOOT_DARK=1 npm run shoot` and review.
- [ ] **I4.** Decide with the user whether `onlyCircleIds` is now removed from
  `TripVisibility` (its job having moved to `RideAudience`) or wired at trip level too.
  Do not leave it dead a second time.
- [ ] **I5.** Report what passed with the actual output. Then, on the user's word, merge to
  `main` and confirm the Pages deploy.

## Verification

1. `npm run verify` — typecheck, pure typecheck, boundaries, dataset, all tests, exit 0.
2. `npm run lint` — clean, including the clock/random bans inside the engines.
3. `npm run e2e` — the existing 16 specs plus the three new ride specs.
4. `npm run personas:flows` — the six persona flows.
5. Rule checks specific to this work: no `full` status persisted anywhere; no ride
   visibility verdict stored; every seat write routed through the FSM; hidden-people counts
   bucketed; `RideCard` takes `RedactedPerson`.

---

## What actually happened — corrections to this plan

Written after execution. The plan was right about the shape and wrong about
three specific things, and the record is more useful than the intention.

### The plan's central claim about `destination` was wrong

Stream G1 said `TripForm` never writes `StayWindow.destination`, so adding a
field would "switch on an engine that is already built". Reading
`domain/tripEntry.ts:152-166` properly shows it **does** write it — as the
**city centroid**, deliberately: *"An area label is a label only — it is never
geocoded, so nothing precise enough to find a door exists."*

So the gap is not a missing field. It is that between two manually entered
trips in the same city the distance is always zero, and the existing 5/15/40 km
filter cannot tell "also going to Marina Bay" from "going to Jurong". Seeded
people have hand-picked neighbourhood coordinates, which is why the demo
discriminates and a real user's trip would not.

Direction, airport and pickup window still do the real work of matching a car.
Sub-city precision needs a closed vocabulary of neighbourhoods with published
centroids — the same shape as the interest-tag vocabulary. That is a dataset
decision and it is **not** done. The limitation is documented at the point
where the tradeoff is made, in `screens/rides/RideSheet.tsx`.

### Two duplicate lists, neither of which the plan predicted

Both were found the same way: by adding a field and watching only half of it
work.

1. **`partialize` duplicated `slice()`** in `state/store.ts`. Rides went into
   `slice()` and not into the hand-written `partialize` object, so shared cars
   worked until the first page reload and then silently were not there.
   Nothing threw. `partialize` now calls `slice()`, so the compiler enforces
   what a comment used to ask for. Caught by an e2e spec that reloads the page;
   26 selector tests had missed it because they set state directly and never
   crossed localStorage.
2. **The invite-code generator** existed as an FNV-1a loop inside
   `data/seed/circles.ts` and was about to exist twice. Extracted to
   `domain/invite.ts` as `codeFromSeed()`.

### `Meet` was cheaper to widen than the plan assumed, and `Channel` did more

The plan treated decision C as a real cost. It was nearly free: `participants`
appeared in five places and `fromRequestId` in exactly one — its own
declaration — because **nothing constructs a `Meet`**. Meanwhile `Channel`
already carried `memberIds: PersonId[]`, already had a `'group'` kind, already
had `openGroup()` in the store, and the seed already shipped a four-member
INSEAD group. The ride room cost about twenty lines.

The lesson worth keeping: two of this plan's three "hard" items were cheap and
the cheap-sounding one (a form field) was the one that turned out to be a
design decision nobody had made.

### Still open

- **`TripVisibility.onlyCircleIds`** is still dead — declared, commented as
  "Restrict this trip to specific circles", and read by nothing. Its job moved
  to `RideAudience` at the ride level, which is a *different* thing from
  restricting a whole trip. It should be deleted or implemented; dead code
  shaped like a privacy guarantee is worse than no code, because a reader
  believes it. Left for the user's call rather than decided unilaterally.
- **Provenance of the 37 place photographs.** All 37 rows in
  `src/assets/places/PROVENANCE.md` read `source: unknown — flagged`. They are
  real photographs of real identifiable places, every file is exactly 640px
  wide (a batch web resize, not a licensed original), and all EXIF is stripped.
  This needs clearing before a public deploy, not after.
- **Fare settlement.** The split is stated and never charged, by design. If
  that is ever meant to become a transaction it is a separate brainstorm.
