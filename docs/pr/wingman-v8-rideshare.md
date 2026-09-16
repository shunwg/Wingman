Shared cars — creating one for others to join, and joining someone else's — in both directions, plus the assets and interaction patterns worth keeping from the `wingman-native` prototype, a per-trip journey rail, and the fixes from a six-agent review round.

**Heads-up on scope:** this branch is cut from `wingman-v7`, and `main` is 12 commits behind that. So this PR carries **30 commits**: the 18 below, plus the 12 v7 typography/photo commits that were already reviewed but never merged. Merging also publishes — `deploy.yml` rebuilds the live link on every push to `main` — so please read the provenance note at the bottom first.

## What this adds

**A shared car is a new n-person `Ride` hanging off a `Trip`.** Bidirectional (`to_airport` / `from_airport`), with three doors: open (the host approves each person), circle-locked (members seat themselves), or link-only (invisible without the key). `Meet.participants` widened from a two-tuple to a list behind a new `makeMeet()` guard that refuses a three-person gate coffee — the invariant moved rather than disappeared. Widening was cheap because nothing constructed a `Meet`; what it buys is a confirmed car inheriting check-ins, guardian sessions, ratings and public-ground enforcement instead of rides reimplementing all four.

A ride's audience is expressed in the **same `AudienceRule` vocabulary** a profile uses, and `RIDE_AUDIENCE_RULES` runs the *same rule objects* — so "women only" on a car and on a profile cannot drift apart. There is deliberately no `full` status: full is `seatsLeft() === 0`, computed on read.

**A journey rail per trip**, both directions — setting off → in the car → checked in → security → gate → boarded, and the mirror on arrival. Self-reported by tap (the clock cannot know whether you are through security or stuck in the taxi) and private until you tap "Tell the car". It is still on every view and animates only at the instant you advance it, which is what lets it exist on a surface `PRODUCT.md` says does not animate.

**From the native prototype:** 37 place photographs, the Car screen's vocabulary as `RideCard`, the "Where you will be" port rail, and place photography on trip and event surfaces.

## Privacy defects found and fixed

Five persona walks and a design review ran against the built feature. They converged on a **consent** failure, not a UI one: the three doors have genuinely different consent models and nothing on screen said so — "Circle only" reads as a tightening while it *waives the host's confirmation*, and the only thing carrying that difference was one verb on a button.

| Found by | Defect |
|---|---|
| Privacy-wary persona | A car was never narrower than its host — someone set to "verified only" published an **open** car. The host's profile audience is now a floor, evaluated as a conjunction. Mutation-checked. |
| Adversarial persona | **A block did not reach the car.** Hide someone, they take a seat in a third party's car, their face returns to your board beside a named airport and a one-hour window. `revokeClaimByPolicy()` — written for exactly this — had **no caller anywhere**. |
| Adversarial persona | **The seat count was an oracle for a decline.** Counting pending asks made seats fall when somebody asked and rise when they were refused, leaking the one fact `claimantView()` exists to hide. |
| Privacy-wary persona | "Hide this trip" did not hide that trip's car — the button and the car rendered in the same card. |
| Design review | The car board's filters were **inert**: fourteen controls in selected states doing nothing. |
| Design review | Dark-mode primary buttons were white on light blue — **2.79:1**, failing AA across the whole app. Dark ink on the same blue is 6.14:1. |

Two bugs were mine and found by tests rather than review: **rides were never persisted** (the store kept its field list twice — `slice()` and a hand-written `partialize`; I updated one, so cars worked until the first reload and then silently were not there — `partialize` now calls `slice()` so the compiler enforces it), and `in_car` being on both journey rails made it the wrong thing to read a direction from, flipping a departing trip onto the arrival rail and declaring the journey over before the flight.

Also corrected: my own claim that a car is "arranged on public ground, like every other meet". The rank is public ground; the car is not, and that was the single place the product addressed the difference — backwards.

## Two things outside the feature

- **`verified_only` is now on by default**, as signup has promised in two places while `defaultPolicy()` shipped `presets: []`. Someone who skips the skippable verify step would have seen an empty board with no explanation, so this adds a `drop_assurance_floor` relaxation: *"Including people who have not verified an account would add 4 more people."*
- **The delete control was never missing** — three reviewers concluded it was, because every screenshot is demo-mode and `YouScreen` shows "Reset the demo" there and "Delete my profile" for a real account. `shoot.ts` now has an account mode; a blind spot three reviewers share is a process bug.

## Please read before merging: photograph provenance

The 37 place photographs are **real photographs taken by people** — established by three independent tests, documented in `src/assets/places/PROVENANCE.md`:

1. This repo's AI images declare themselves in their own bytes (`hero-terminal.jpg` carries a signed C2PA manifest naming OpenAI's image model; all 16 portraits carry IPTC `trainedAlgorithmicMedia`). **0 of 37** place files carry any such marker.
2. Seven ICC identities across four colour spaces including ProPhoto RGB and Adobe RGB — a photographer's raw-editor choices, not one generator's output.
3. Correct checkable detail: Finnair's counterintuitive `AY`, two airlines defunct since 1992 and 2002 with period logos, and "Terminal 2 | The Queen's Terminal", Heathrow's real official name.

The sourcing decision is on record from **2026-09-06**, six days before the files existed: places from Unsplash under its commercial-use licence, people AI-generated — and the bytes corroborate that split. But **source and licence are `unknown` for all 37 individual files**: the 640px resize stripped EXIF, and a reverse image search (which the authoring environment could not perform) is what would settle them.

A real photographer holds copyright in each. Merging republishes the live link, so this is worth clearing first.

## Verification

- `npm run verify` — 495 tests, 54 files, typecheck + pure typecheck + import boundaries + airport dataset, exit 0
- `npm run e2e` — 20 specs, including 5 new shared-car flows and the dead-ends sweep extended to cars and their dead links
- `npm run lint` clean; `SHOOT_DARK=1 npm run shoot` re-run in both themes
- `/impeccable detect` on the new UI: zero findings

## Still open

`TripVisibility.onlyCircleIds` remains dead — declared, commented "Restrict this trip to specific circles", read by nothing. Its job moved to `RideAudience` at the ride level, which is not the same as restricting a whole trip. Delete or implement; dead code shaped like a privacy guarantee is worse than none.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
