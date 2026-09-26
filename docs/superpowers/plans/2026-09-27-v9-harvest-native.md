# v9 — harvest the native prototype: implementation plan

> Spec: `docs/superpowers/specs/2026-09-27-v9-harvest-native-design.md`. Executed inline, TDD per
> task, `npm run verify` + `npm run lint` green before each commit. Branch `wingman-v9`.

**Goal:** an agreed plan per room and per car, the car's money and pickup note, a demo where your
hello gets a yes, departure time on Home, draggable sheets, the prototype archived — then persona
QA until nothing is open.

## Tasks

### 1. Domain: plans, places, money
- `domain/meet.ts`: proposal body gains `placeKind?`; bodies `agreed` and `plan_off`
  (`proposalId: MessageId`). `PublicPlace.kind` gains `pickup_point`.
- `domain/guards.ts`: `pickup_point` in `PUBLIC_KINDS`.
- `domain/plan.ts` (new): `canAgree`, `agreedPlan`, `meetFromPlan`, `meetForRide`,
  `meetIdForRequest`, `meetIdForRide`.
- `domain/ride.ts`: `fare?`, `pickupNote?`, guards in `makeRide`, `fareEach`, `PICKUP_NOTE_CAP`.
- Tests: `domain/plan.test.ts`, additions to `ride.test.ts`, `guards.test.ts`.

### 2. State: writes and reads
- `state/machines/plan.ts`: `assertCanAgree`, `assertCanCallOff` — throw with the reason.
- `store.ts`: `agreeTo(channelId, proposalId)`, `callOffPlan(channelId)`; demo agreement when you
  propose; demo proposal when you accept an inbound hello; `setRideFare`, `setPickupNote` (host
  only); `answerDemoRequest(requestId)`; `rate()` keyed per `(meet, ratee)` with derived ids;
  `hostRide` passes `fare`.
- `state/selectors/plans.ts` (new): `usePlanForChannel`, `usePlansForTrip`, `useSaidYes`.
- Tests: `state/selectors/plans.uitest.tsx`, rides uitest additions.

### 3. Screens: the room and the trip
- `ProposeSheet`: place-kind chips.
- `ChannelScreen`: plan strip, card states, That works / Call it off; guardian window from the
  plan; guardian + "We've met" in car rooms with a rider chooser.
- `TripsScreen`: Plans section.
- Copy in `data/copy/plans.ts`. CSS in `screens.css`.

### 4. Screens: the car's money
- `RideSheet`: optional estimate + currency (default from airport country via
  `data/currency.ts`).
- `RideCard`: share line. `RideScreen`: money panel, pickup note (host edit, riders read, others
  told it is held). Car room strip: amount + note.
- Seeds: fares on the seed cars, a pickup note on one.

### 5. They said yes
- `screens/_shell/useDemoAnswers.ts`: demo-only timer → `answerDemoRequest`.
- Home: "<name> said yes" row → `markArriving` + open the room.

### 6. Home departure line · 7. Sheet drag · 8. Archive `wingman-native`

### 9. QA loop
`npm run verify`, `npm run lint`, `npm run e2e`, `SHOOT_DARK=1 npm run shoot`; five persona agents
and a design review against the running build; fix; repeat until no open issue. Reports in
`testing/reports/2026-09-27/`.

### 10. Ship
Push `wingman-v9`; fast-forward `main` locally; the owner pushes `main` (Pages deploys from it).
