# Wingman v9 — what the native prototype knew that the app did not

**Branch:** `wingman-v9` → `main` · **Spec:** `docs/superpowers/specs/2026-09-27-v9-harvest-native-design.md`

The two apps are now one. A line-by-line read of `wingman-native` (2026-09-19) found four things it
could show that the product could not; this builds them, archives the prototype, and then runs the
persona QA loop until nothing blocking is open.

## What ships

| Feature | What it does |
|---|---|
| **Agreeing a plan** | "That works" on the other person's suggested time. The plan is derived from the room's log — never stored — pinned at the top of the room, changes only when the other person agrees, can be called off, and appears under *Plans* on the trip. `makeMeet()` finally has a caller. |
| **What the car costs** | A host's optional estimate; each viewer sees *their* share ("About SGD 18 each with you in", "…£X if it fills"), rounded up, never a charge. |
| **Pickup note** | The exact spot and car, for the people in the car only (a render test proves a browser never sees it). |
| **Someone says yes to you** | Demo only, your hello is answered a few seconds later through the request FSM, and the screen says so. Home shows "Jonas said yes" until you open the room; tapping plays the arrival moment. |
| **Hellos ask about the right time** | The window comes from the overlap (landing for a ride in, before boarding for a coffee), not "the next 90 minutes". |
| **Smaller** | "Leaves LHR 21:00 tonight" on Home; every sheet drags closed; a Home row for cars going your way; a host hears about seat requests on Home and in the Inbox. |
| **Prototype archived** | `wingman-native`'s link redirects here; its rebuild workflow is removed (commit on that repo, not yet pushed). |

## Bugs found and fixed on the way

- Room times were UTC — a 19:30 coffee at Heathrow read 18:30.
- A seat in someone else's car never appeared on your own trip; "Tell the car" never appeared for passengers.
- Agreeing to meet anyone settled the trip and took away its journey rail, "Share a car", every car going its way, and its place as your next journey. `tripIsOpen` / `tripIsListed` / `tripIsOver` are now three functions.
- A car's room kept people who had left or been removed (a stored copy of derived state, rule 2); a removed passenger could re-take a seat through a link.
- One person could re-create a plan the other had called off; the log accepted `agreed` from anyone.
- Hiding someone left the agreed plan, room, trip line and notice standing.
- Request ids could collide after a reload; one demo yes accepted two people.
- An address could be typed into any place label or pickup note; now refused (`looksLikeAddress`).
- `#/demo` silently replaced a real profile.
- Calling a car off claimed to tell the riders and told nobody; rating a second rider erased the first.
- The offer form's controls had no CSS at all; its date was the flight's UTC date.
- The router's only Suspense boundary blanked the whole app, tab bar included, on every first screen load.
- A circle's member list and the event board ignored hides and each member's own audience: a verified-only member was listed to an unverified stranger, and a person you hid stayed on the event you were both at. Both now go through the same identity rules as a car's door (`admitsListing`), list to members only, and honour "When not travelling".
- A guardian watch outlived its car, and "Ingrid is watching" claimed a link had gone out when nothing is sent. A watch now ends with its meet (never once it has raised the alarm), is always on Home with "I'm safe", and says it is a stand-in.
- Every sheet renders into `<body>`: a stacking context could put the tab bar over a sheet's buttons (Report on a profile took the Circles tab's tap).
- A trip that is only a stay never ended; a form-entered stay "ended" at a noon nobody entered.

## Gates

`npm run verify` · `npm run lint` · `npm run e2e` · `npm run personas:flows` · `SHOOT_DARK=1 npm run shoot` — results in the QA section below.

## QA

Six rounds of persona review: bad actor, privacy-wary, nervous flyer, reluctant host, the INSEAD cohort sharer, and a design reviewer. Each round checked the last round's findings closed and then attacked the fixes. The durable record is `docs/reviews/2026-09-27-personas.md`.

| Round | Blockers | Result |
|---|---|---|
| 1–3 | 0 | Majors fixed in `de77be2` … `b0fdb49` |
| 4 | 1, pre-existing (listings ignored hides and audiences) | Fixed in `1f0e8fe` … `118c831` |
| 5 | 1, introduced by round 4's fix (a membership oracle in the circle room's hide notice) | Fixed in `3ed8bf9` |
| 6 | 0 | People and design: **ship**. Privacy and bad actor: one address-check major, fixed in `a78ba99` |

**Open at merge:** no blockers, and no majors introduced by v9. What remains is deferred and predates v9. The biggest item: there is no backend, so a car offered on one phone never reaches another. See the roll-up's Deferred table.

**Gates at `a78ba99`:**
- `npm run verify` 738 tests;
- `npm run lint` clean, boundaries intact;
- `npm run e2e` 23/23;
- `npm run personas:flows` 6/6;
- `SHOOT_DARK=1 npm run shoot` 68 captures, no console errors.

Each behavioural fix from rounds 3–6 has a test, and each such test was checked by reverting its fix and watching it fail.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
