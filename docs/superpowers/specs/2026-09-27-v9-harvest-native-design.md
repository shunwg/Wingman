# v9 — what the native prototype knew that the app did not

**Status:** approved 2026-09-27 ("combine the best of the two … continue doing QAs until you have a readily shipped product").
**Decisions taken with the user, 2026-09-20:**

| Question | Answer |
|---|---|
| How should the two apps end up? | **One app, web only.** `wingman-native` is archived as a design reference and its Pages site stops serving the old prototype. |
| What first? | **Agreeing on a plan**, then the rest of the harvest. |
| When a time is agreed and someone suggests another? | **It only changes by agreement.** The agreed plan stands until the other side accepts the new one. |
| Where does an agreed plan show? | **The room and the trip.** Not Home. |
| Do cars negotiate? | **No — the host sets the time, but a confirmed car still has a plan**, so guardian, check-ins and ratings work in a car. |
| `pickup_point` as a new `PublicPlace` kind | Approved with the go-ahead. |

## Why

A line-by-line read of both apps (2026-09-19) found the native prototype demonstrates four things
the product cannot do. Everything else it shows, the web app already does, usually more deeply.

1. **An agreed plan.** `Meet` is fully modelled (`domain/meet.ts`) and vetted by `makeMeet()`,
   which has no callers. A proposal can be added to a calendar or countered; nobody can say yes to
   it, so a room never produces a plan.
2. **What the car costs.** A ride carries `fareSplit: 'even' | 'host_pays'` and no amount.
   `fareShare()` exists and is never called. The cohort persona's success criterion — "the money
   question is answered on screen without her having to raise it" — fails.
3. **Pickup specifics for the people in the car.** The exact spot, time and car are nowhere.
4. **Someone saying yes to you.** In the demo a hello you send is never answered, so the sender's
   half of the product is unreachable, and the signature moment only ever plays on *your* yes.

Two smaller ones ride along: the next departure time on Home's journey card, and sheets you can
drag closed.

Three things the native app does are deliberately **not** carried over, because each breaks a
load-bearing rule: naming a hidden person ("Omar … is not shown"), an exact small hidden count
("2 more hidden"), and a read receipt on a hello ("she has not opened it yet").

---

## 1. Agreeing on a plan

### The plan is the log

The agreed plan is **derived from the room's messages**, never stored.

- A proposal is a message (exists). It gains an optional `placeKind`, so the place it names is a
  typed `PublicPlace` rather than a string. Absent → `terminal_landmark`, the vaguest public kind,
  which is what every proposal persisted before v9 becomes.
- Saying yes posts `{ kind: 'agreed', proposalId }`.
- Calling it off posts `{ kind: 'plan_off', proposalId }`.
- `agreedPlan(messages)` (pure, `domain/plan.ts`) walks the log in order. The last valid agreement
  wins; a `plan_off` naming the current plan clears it. The `Meet` is then built by the existing
  `makeMeet()` — which finally gets its first caller.

Rejected alternatives: a stored `meets` slice (duplicates the request and the ride, drifts, needs a
migration, stores derived state against rule 2); a field on `MeetRequest` (a request is the ask,
not the plan, and cannot express a plan that moves).

### Validity — one function, used by both the write and the read

`canAgree(proposal, by, at)` returns a reason or `null`:

- you cannot agree to your own suggestion (`own`);
- you cannot agree to a time that has already started (`past`);
- the proposal must be in the same channel and be a proposal (`not_a_proposal`).

The store's write path (`state/machines/plan.ts`, rule 5) throws on any reason. The derivation
ignores any `agreed` message that fails the same check, so a hand-edited or replayed log cannot
produce a plan the write path would have refused.

### Behaviour

| Situation | Room shows |
|---|---|
| No plan | Proposal cards as today. The other person's future proposal gets **That works**. |
| A plan | A strip under the header: *Agreed · Coffee at the gate · 17:25–17:55 · Gate B8*, with Add to calendar, Suggest a change, Call it off. The agreed card is marked **Agreed**. |
| A plan and a newer suggestion | Both. The strip is unchanged; the new card offers **That works**. Accepting moves the plan and the log says so. |
| Your own suggestion | Add to calendar, and "Waiting on <name>". Never That works. |
| A suggestion whose time has started | "That time has passed". |

### Cars

`meetForRide(ride)` derives a car's plan straight from the ride: participants are the riders,
the window is the host's, the kind is `ride_share`, and the place is

- **from the airport** → `taxi_rank` at the airport ("Taxi rank · SIN"),
- **to the airport** → the new `pickup_point` kind at `ride.point` (a neighbourhood centroid by
  construction, so it cannot carry an address — rule 6 holds).

No plan while fewer than two riders, or once the car is cancelled.

### Where it shows

- **The room** — the strip, as above.
- **The trip** — a *Plans* section in the trip block, sorted by start, each row tapping through to
  its room. Pairwise plans belong to `request.tripId`; car plans to `ride.tripId` for the host and to
  the rider's trip on the same airport and date for a passenger.

### Free fixes that come with it

- **The guardian watches the agreed window**, not the one first asked for; in a car room it
  watches the ride's window. "Tell someone where you are" appears in car rooms — the one meet you
  cannot walk out of.
- **Meet ids are derived, not cast.** `meetIdForRequest` / `meetIdForRide` replace
  `asMeetId(channelId)`. The strings are chosen to equal the room ids so every rating already on a
  device still resolves.
- **Rating a car rates each person.** `rate()` currently replaces every rating for the meet, so
  rating a second rider erased the first; it now replaces per `(meet, ratee)`. "We've met" in a car
  room asks who to rate.

### Demo

Deterministic and honest, like scripted replies:

- Accepting Priya's hello opens her room, where she has already suggested a time inside her
  request's window. That works → the strip appears.
- In demo mode, when you suggest a time, the other person agrees to it.

---

## 2. The car's money, and the details only the car sees

### Model

`Ride` gains two optional facts, both stated by the host, neither a transaction:

- `fare?: { amountMinor: number; currency: string }` — the whole car, an estimate. Currency is
  ISO 4217 and defaults from the airport's country.
- `pickupNote?: string` — ≤160 characters. "Rank door 12, white estate, plate ends 4R."

`makeRide()` refuses a non-positive or non-integer amount, a currency that is not three letters, and
a note over the cap. Optional fields, so no migration.

`fareEach(ride, people)` (pure) is the per-person share, rounded up to a whole unit so nobody is
quoted less than they will pay; `host_pays` → 0.

### What each person sees

| Viewer | Money | Pickup note |
|---|---|---|
| Browsing the board | "About €38 each with you in" | not shown; "Exact spot and car shared with the people in it" |
| Asked, not yet in | same | same |
| In the car / host | "About €50 each now · €38 each if it fills" | shown; host can edit |
| Car room | fare strip names the amount | pinned under the fare strip |

The note is gated on **being in the car**, not on the car filling. The native prototype released it
when the last seat filled; that means a car that never fills never tells its passengers where to
stand. Being confirmed is the rung that matters.

### Where it's set

The host form gains an optional estimate with a currency select. The car screen lets the host add
or edit the estimate and the pickup note after the fact — a host rarely knows the plate when
offering the car.

---

## 3. Someone says yes to you

- **Demo only**, a few seconds after you send a hello, the seeded person accepts it through the
  request FSM (`sent → viewed → accepted`). A shell-level effect owns the timer; the engines stay
  clockless. In a local account nobody answers, because nobody is there.
- **Home** shows "Jonas said yes" while the room is unread since the yes (derived from `readAt`,
  nothing stored). Tapping it plays the existing signature arrival and opens the room.
- The inbox row already appears; nothing changes there.

---

## 4. Small ones

- **Home's journey card** names the next departure within 24 hours: "Leaves LHR 21:00 tonight".
  Local time at the render edge (rule 4).
- **Sheets drag closed.** A grab handle, a downward drag past 96px or a fast flick dismisses;
  anything less springs back. Reduced motion keeps the gesture and drops the spring.

## 5. Archiving the prototype

`wingman-native`: a README banner pointing at the product, the rebuild workflow removed, and
`docs/` replaced by a redirect to `shunwg.github.io/Wingman/`. The GitHub-side archive switch is the
owner's.

## Out of scope

Reminders and notifications; Home plan surfaces; no-show handling; cars negotiating their time;
payments of any kind.

## Testing

- **Pure:** `canAgree`, `agreedPlan` (agree, move, call off, own/past refusal, replayed log),
  `meetForRide` both directions, `fareEach` rounding and `host_pays`, `makeRide` fare/note guards,
  `makePublicPlace('pickup_point')`.
- **UI/selectors:** one plan per room; a newer suggestion does not move it; the trip lists plans;
  a rider leaving below two clears the car's plan; the pickup note is absent from a non-rider's row;
  rating two riders keeps both.
- **E2E:** accept Priya → That works → strip → trip shows the plan; host adds a fare → card shows the
  share; send a hello in the demo → Home shows the yes → room opens.
- **Personas:** the five from 2026-09-16 re-run against the build, plus a design review, until no
  open issue remains.
