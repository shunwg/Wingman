# Shared cars, and the consolidation of the native prototype — design

**Date:** 2026-09-16
**Status:** approved (brainstormed and confirmed in session, 2026-09-16)

## Goal

Make Wingman work on both sides of a shared airport car — creating one for others to
join, and joining someone else's — in both directions (a location to an airport, and an
airport to a location). Fold in the visual assets and the interaction patterns that the
`wingman-native` prototype got right, and the QA findings from both apps. The native
prototype stays a prototype; everything lands here.

## Why this is smaller than it looks

Four things were found by reading the code rather than assuming:

1. **The domain already anticipated ride-sharing and stopped one step short.**
   `StayWindow.destination` (`domain/trip.ts`) is a coarse `{ lat, lon, label }` whose own
   comment says it exists so that *"share the ride in"* is answerable — "a neighbourhood
   centroid answers 'are we going the same way' and nothing narrower." The board already
   reads it, computes `destinationKm`, and runs a working within-5/15/40 km filter
   (`state/selectors/board.ts`). **`TripForm` never writes it** — it writes only the free-text
   `areaLabel`. So directional matching works for seeded people and is unreachable for a
   real user. One form field switches on an engine that is already built and tested.

2. **A shared car cannot be represented today.** `Meet.participants` is a strict
   `[PersonId, PersonId]` and `MeetRequest` is strictly `from → to`. Four people splitting a
   fare is not six pairwise meets.

3. **`Meet` is declared and constructed nowhere.** There is no `meets` slice in the store;
   the only `meets:` in the codebase is a reputation count on seeded people. Widening it is
   therefore safe, which is what makes decision C below cheap.

4. **N-person rooms already work.** `Channel` carries `memberIds: PersonId[]`,
   `ChannelKind` already includes `'group'`, `openGroup()` exists in the store, and the seed
   ships an INSEAD group channel with four members. The ride room is nearly free.

And one piece of dead code that this work is the reason to fix:
`TripVisibility.onlyCircleIds` is declared with the comment "Restrict this trip to specific
circles" and read by **nothing**. Dead code shaped like a privacy guarantee is worse than
no code, because a reader believes it.

## Decisions taken

| Decision | Choice | Why |
|---|---|---|
| Where a ride lives | **Extend `Trip`** — a `Ride` hangs off a trip via `tripId` | The first customer always already has a trip in the system and also wants a car; `ride_share` is already one of the `MeetKind`s a trip opens to |
| Direction | **Bidirectional** — `to_airport` and `from_airport` | Asked and confirmed. `ride_share` was previously documented as "landside, shared transfer into town", i.e. one direction only |
| Group shape | **A new n-person `Ride`** *and* **widen `Meet.participants` to `PersonId[]`** | The `Ride` is the offer (seats, fare, audience, claims); the `Meet` is the encounter, and widening it lets a confirmed car inherit check-ins, guardian sessions, ratings and public-ground enforcement instead of reimplementing all of it. Also unlocks group dinners, which a 500-person cohort wants |
| Join modes | **open + filters · circle-restricted · invite code** | Asked and confirmed |
| Seating on an open ride | **Auto-seat on circle-restricted and invite rides; host approves on fully-open ones** | "Anyone who matches" on a fully open ride puts a stranger in a car with you. The car is the one surface where this product should stay conservative. The host can override |

## Architecture

No new axis. The work lands inside the existing folders and respects every import
boundary in `CLAUDE.md`.

### Domain — `src/domain/ride.ts` (new)

```ts
export type RideDirection = 'to_airport' | 'from_airport';

/** The non-airport end. Coarse by type, exactly like StayWindow.destination. */
export interface RidePoint { lat: number; lon: number; label: string }

export interface Ride {
  id: RideId;
  hostPersonId: PersonId;
  tripId: TripId;
  direction: RideDirection;
  airportIata: IataCode;
  point: RidePoint;
  window: TimeWindow;          // pickup window, UTC
  seatsTotal: number;          // including the host
  claims: RideClaim[];         // append-only; facts, not derived
  audience: RideAudience;
  inviteCode?: string;         // 6 chars, the circle-invite format
  status: 'open' | 'confirmed' | 'departed' | 'completed' | 'cancelled';
  history: RideEvent[];        // append-only, the FSM's only source of truth
  createdAt: ISODateTime;
  expiresAt: ISODateTime;      // pinned to the window; a ride cannot outlive its trip
}
```

There is deliberately **no `full` status**. "Full" is `seatsLeft(ride) === 0`, computed on
read. Persisting it would violate rule 2 and could disagree with the claims that produced
it.

`RideId` joins the branded ids in `domain/ids.ts` with its `asRideId` constructor.

### Decision C, concretely

In `domain/meet.ts`:

- `participants: [PersonId, PersonId]` → `participants: PersonId[]`
- `fromRequestId: MeetRequestId` → `origin: { kind: 'request'; requestId: MeetRequestId } | { kind: 'ride'; rideId: RideId }`

Widening loses a type-level guarantee, so it is replaced by an enforced one: `makeMeet()`
in `domain/guards.ts` — the same idiom as `makePublicPlace()` — refusing fewer than two
participants, duplicates, and more than two on a pair-only `MeetKind`. A gate coffee
cannot silently become a group.

### FSM — `src/state/machines/rideSeat.ts` (new)

Modelled on `meetRequest.ts`: `requested → confirmed | declined | withdrawn | expired |
revoked_by_policy`, throwing on illegal transitions. Every seat write goes through it
(rule 5). A separate small table governs the ride's own lifecycle.

### Privacy — one model, not two

```ts
export type RideAudience =
  | { kind: 'open'; rules: AudienceRule[] }
  | { kind: 'circles'; circleIds: CircleId[] }
  | { kind: 'invite' };
```

`open` reuses `AudienceRule` from `privacy/`, so "women only" or "verified only" on a car
is the same rule type, compiled by the same engine, as on a profile. `circles` is the real
implementation of what `onlyCircleIds` only declared, and it inherits the lesson of commit
`f64b42d`: an empty circle list means **nobody**, never everyone — asserted by a test.
`invite` reuses `parseInvite()`.

Eligibility is computed on read, never stored (rule 2). Counts of hidden people go through
`lib/bucket.ts` (rule 3). Seats-left is exact, because seat inventory is not a person.

### Matching — `src/matching/filters/rideFilters.ts` (new)

Direction, airport identity, pickup-window overlap, and going-the-same-way proximity via
the haversine already behind `destinationKm`. No new geo code. `privacy/` still never
imports `matching/`.

### Surfaces

- **Host:** a "Share a car" sheet on a trip — direction, where, pickup window, seats, who
  can join, fare split. Its "where" field writes `StayWindow.destination`, which is what
  switches on the existing proximity filter.
- **Join:** a "Shared cars" lens on Discover, and a `RideCard` carrying the route rail,
  pickup time, seats left, who is in, and the split line.
- **Room:** `openGroup()` with the claimants plus a persistent split-cost strip.
  `JourneyStage` updates already work n-person.
- **Invite:** `#/ride/<code>`, mirroring the already-tested circle-invite route.

### Ported from `wingman-native`

| Ported | Left behind |
|---|---|
| The Car screen's vocabulary → `RideCard` and the ride room | Welcome — wingman's is better and real |
| CarChat's persistent split-cost strip | Lens chips — wingman's are richer |
| Place photography on trip / port / event cards | Privacy toggles — wingman's engine is far ahead |
| The "Where you will be" port rail | Anything backed by a hardcoded array |

### Assets

~40 place photographs (2.4 MB; OSL, LHR, CPH, SIN, CDG, plus stock atmosphere) move to
`src/assets/places/` with a `places.ts` map — Vite `import`, no Metro `require()`
constraint. The 16 people portraits are already byte-identical in both repos; nothing to
merge. A `PROVENANCE.md` records source and licence per file: the native README says
"licensed photos" but ships no manifest, so any file whose provenance cannot be
established is flagged rather than quietly shipped.

## Testing

- Pure engine tests for `rideFilters`, the audience compiler, `seatsLeft`, and the FSM's
  illegal transitions.
- A property test that an empty `circleIds` list admits nobody.
- A test that `makeMeet()` refuses a three-person gate coffee.
- E2E: host a ride → it appears on another persona's board → join → the room; invite-link
  join; and a filtered-out viewer **not** seeing the ride.

## Out of scope

Real payment or fare settlement (the split is a stated intent, not a transaction);
recurring-trip detection ("you and 40 classmates all fly back Sunday"); more than one car
per trip leg; and any live ride-hailing integration. Each is a separate brainstorm.
