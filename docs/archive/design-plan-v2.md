> **Superseded 16 Aug 2026.** This is the v2 brief (Oslo ride-matching, dark "midnight terminal" palette). The shipped app is light-first, worldwide, and about meeting rather than ride-splitting — see `CLAUDE.md`. Kept for §10's motif decisions, which still hold: boarding pass, split-flap, route line + orbit ring are the essential motifs; airplane icons, clouds, globes, map pins and purple gradients are banned.

# Wingman — Revised Design Plan

**North star:** *The arrival board for your last mile.*
**Setting:** Oslo — OSL Gardermoen → the city. Currency NOK. Cab vs. Flytoget as the real-world tension.
**Status:** v1, for sign-off before build · 15 Aug 2026

---

## 0. The reframe in one paragraph

The main object in Wingman is no longer a profile card — it is a **live shared-route board**. You land at 22:10; three people land inside your window; one route overlaps yours; your likely saving is 187 kr; your shared transfer is waiting to be confirmed. Profiles support that decision, they are not the product. The flirty energy survives in the copy and the blush accent, but it sits *behind* the usefulness, never in front of it. Every screen is built to answer the three emotional questions at once — *am I safe, does this save me something, could this be a good moment* — through geometry, stamps, and split-flap numbers rather than filters and percentages.

---

## 1. The ten answers — decision summary

| # | Brief question | Decision |
|---|---|---|
| 1 | Single unforgettable interaction | **The Pass-Lock** — two boarding passes align and fuse at their perforations when a match clears; the fare split-flaps from solo to split |
| 2 | Default matching experience | **Convergence map + live board strip**; the card list stays as an accessible toggle |
| 3 | Progression to confirmed companion | Signal → **Join My Route** → **Cleared** → **Gate Check** → **Boarding Together** → **Arrived** |
| 4 | What users see per privacy level | A four-level ladder; photo and first name are *earned* at Cleared; a public meeting point replaces anyone's address |
| 5 | First 10 seconds after a flight | The board writes itself: flight confirmed → scan → your route drawn → convergers fade in — no spinner, ever |
| 6 | "No matches yet" | **"You're first on this route tonight"** — the board keeps watch, shows solo baselines, and quantifies what widening your window would unlock |
| 7 | Essential vs. banned motifs | Essential: boarding pass, split-flap board, route line + orbit ring. Banned: airplane icons, clouds, map pins, purple gradients |
| 8 | Labels replacing Wave / Pass / Matched | **Join My Route** / **Different Route** / **Cleared** (then **Boarding Together** once confirmed) |
| 9 | Precise numbers vs. visual shorthand | Times, metres, kroner, flight numbers: precise monospace. Compatibility: a **Route Receipt** — the % score is deleted from the product |
| 10 | Why someone shows a friend | The saveable **locked-pass stub**: both names, route, saving, CLEARED stamp — designed to be screenshotted |

---

## 2. The unforgettable interaction — the Pass-Lock

When interest becomes mutual, the app earns its one big moment. Both boarding passes slide in from opposite edges of the screen — yours from the left, theirs from the right — drift until their perforation dots meet, and fuse: a single dashed tear-line stitches across both passes. A stamp rotates in slightly off-axis (real stamps are never straight): **CLEARED FOR SHARED RIDE**. Then the money flips on split-flap digits — `749 kr solo` → `375 kr each` — and one final line types itself in monospace: `MEET EXIT B · 22:18–22:25`. About 1.6 seconds end to end, no confetti, no sound, skippable, honoured by `prefers-reduced-motion`. It should feel like a travel plan becoming real, not a slot machine paying out.

This is the screenshot moment, and it is also the trust moment: the same screen carries a small safety card stating exactly what has and has not been shared (see §6).

## 3. Default matching experience — the convergence map

The default `/matches` view is a stylised night-operations map, not a ranked list.

| Element | Behaviour |
|---|---|
| OSL node | Sits at the top as a glowing runway bar — amber, quietly pulsing |
| Journey lines | Each compatible traveller is a signal moving along a thin line from the runway toward the city grid |
| Your orbit ring | Your destination zone is a soft 1 km ring, drawn slightly hand-hewn, breathing on a ~6 s cycle |
| Drop-off clustering | Compatible travellers' drop-offs sit *visibly inside* your ring — the 1 km rule becomes geometry you understand before you read a single number |
| Board strip | A split-flap strip above the map: `3 LAND IN YOUR WINDOW · 2 ON YOUR ROUTE · LIKELY SAVING 150–220 KR` |
| Tap a signal | The traveller's boarding-pass card expands with their Route Receipt |
| List toggle | A wayfinding-sign toggle (`MAP ⇄ LIST`) keeps the ranked card list as the accessible, screen-reader-friendly alternative |

Why a map and not a list: a list makes people compare *people*; the map makes them see *routes converging*, which is the honest promise of the product. The map is not a real map — it is a drawn city grid (an editorial illustration of Oslo, not Google tiles), which keeps it cinematic, fast, and privacy-soft.

## 4. Progression — from anonymous signal to ride companion

| Stage | Trigger | What it means | Expiry / exit |
|---|---|---|---|
| **Signal** | You both entered trips | Anonymous presence on each other's maps | Disappears when either trip ends |
| **Join My Route** | One-way tap | Soft interest, sent with a constrained note ("Happy to split a cab") | **Auto-expires at wheels-down** — the countdown is visible, so no lingering awkwardness |
| **Cleared** | Mutual join | Pass-Lock plays; names + photos unlock; Signals chat opens; a *public* meeting point is proposed | Either side can tap **Plans Changed** — quiet, no-fault |
| **Gate Check** | ~30 min before landing | Both confirm three things: transport mode, rough fare expectation, handoff window | Unconfirmed Gate Check at T-0 → match lapses gracefully |
| **Boarding Together** | Both gate-checked | The confirmed state: `MEET EXIT B · 22:18–22:25`, fare split locked | — |
| **Arrived** | Post-ride | Passport stamp on the trip timeline; trip archives | — |

**Declining** is always **Different Route** — a phrase about geography, not about the person. **Chat** is called **Signals** and opens with quick-reply templates ("I'll be at arrivals", "Train works for me", "Running 10 min late") so nobody has to compose a message to a stranger from a jet bridge.

## 5. Privacy ladder — what is visible when

| | Level 0 · Browsing | Level 1 · Joined their route | Level 2 · Cleared | Level 3 · Boarding Together |
|---|---|---|---|---|
| Identity | Silhouette avatar, no name — "Traveller on AY917" | Same, plus your join note | **First name + photo** | Same |
| Destination | Neighbourhood only — "near Tøyen" | Same | Still neighbourhood; a **public meeting point** is proposed instead | Handoff window at the meeting point; drop-off order settled in the cab |
| Time | Landing time + delta vs. yours | Same | Exact minute deltas | Confirmed window `22:18–22:25` |
| Money | Estimated split range | Same | Solo vs. split, precise | Locked split |
| Contact | — | — | Signals chat (in-app, templated) | Same — **phone/email never exchanged in-app** |

The principle: **identity is earned by mutuality, location is earned by confirmation, and exact addresses are never shared at all** — the meeting point (Exit B, the Flytoget platform) is always public ground.

## 6. Trust model — visible in the flow, not on a settings page

| Moment | Trust signal shown |
|---|---|
| Browsing | "near Sofienberg", distance rounded to 50 m, silhouette avatars — the map itself demonstrates the privacy level |
| Before joining | The join note is chosen from templates — you cannot overshare by accident |
| On Clearing | The Pass-Lock screen carries a small card: *"Shared: first names, photos, flights, meeting point. Not shared: addresses, phone numbers, live location."* |
| Gate Check | Mode + fare expectation + window confirmed by **both** — no one gets into a cab with mismatched assumptions |
| Any time | **Plans Changed** — one tap, ends the match quietly, prevents ghost matches; the other side sees "route changed", nothing more |

## 7. First 10 seconds after entering a flight

| Time | What happens |
|---|---|
| 0–2 s | Flight chip confirms itself: `DY1305 · CPH→OSL · LANDS 22:10` types across the board |
| 2–4 s | Scan line flips: `SCANNING · 14 TRAVELLERS · 6 FLIGHTS TONIGHT` |
| 4–7 s | The map draws *your* line, runway to Grünerløkka; your 1 km ring pulses once |
| 7–10 s | Converging signals fade in inside the ring; board resolves: `2 ON YOUR ROUTE · LIKELY SAVING 150–220 KR` → CTA **See who's converging** |

The user gets value (their own route, drawn and priced) even before any match logic resolves — which is exactly what makes the empty state work.

## 8. Empty state — "You're first on this route tonight"

No spinner, no sad illustration. Your route stays drawn, your ring keeps breathing, and the board says `YOU'RE FIRST ON THIS ROUTE TONIGHT — SIGNAL STAYS ON UNTIL WHEELS-DOWN`. Below it, three useful things:

| Element | Content |
|---|---|
| Solo baseline strip | `CAB SOLO 749 KR · FLYTOGET 240 KR · VY 124 KR` — the app is a useful transfer reference even with zero matches |
| Widen-window nudge | A concrete, honest unlock: "±90 min would put **2 more travellers** in your window" — tap to widen |
| Watch promise | "We'll flag anyone who converges before you land" with a live count of travellers landing at OSL that evening |

Hopeful, precise, and still worth a screenshot.

## 9. Compatibility — the Route Receipt replaces the score

The `87% compatible` number is deleted. Eligibility is **binary and filtered** (non-matches never appear), and fit is shown as a stamped receipt readable in under three seconds:

```text
YOU + MAYA                    DY1305 / SK272
Landing gap                          +18 MIN
Drop-offs apart                        420 M
Both chose "quiet ride"                    ✓
Cab preference                    COMPATIBLE
Estimated saving                 187 KR EACH
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
STATUS                 ELIGIBLE FOR SHARED RIDE
```

Internally, ranking is still a weighted sum — time 0.45, distance 0.35, vibe 0.20 over hard filters (window overlap for *both* parties, ≤1 km haversine, mode compatibility, openness settings) — but the weightings only ever set the *order* of the map signals and list. The user sees reasons, never a grade on a stranger.

| Shown as precise monospace | Shown as visual shorthand |
|---|---|
| Times, landing deltas (`+18 MIN`) | Fit → Route Receipt stamps |
| Distance between drop-offs (`420 M`) | 1 km rule → your orbit ring |
| Fares and savings (`375 KR EACH`) | Vibe overlap → shared baggage-tag chips |
| Flight numbers, handoff windows | Trust state → passport stamps |

## 10. Visual system

**Three essential motifs** (everything on every screen maps to one of these):

| Motif | Used for |
|---|---|
| **Boarding pass** — bone-paper card, notched edges, perforation dots, dashed tear line | People, matches, the trip form, the Pass-Lock |
| **Split-flap board** — monospace flip digits | Times, deltas, savings, status lines, the hero sentence |
| **Route line + orbit ring** — thin amber lines, hand-hewn 1 km ring | The convergence map, shared-route sketches, the hero animation |

Supporting cast: baggage-tag chips (vibes, preferences), wayfinding signage (navigation, filters), passport stamps (CLEARED / BOARDING TOGETHER / ARRIVED). **Banned:** airplane icons and emoji, clouds, globes, cockpit/pilot imagery, generic map pins, airline logos, seatbelt clichés, and any purple-gradient SaaS look.

**Tokens** (all defined once, semantic use only):

| Token | Value | Role |
|---|---|---|
| `--midnight` | `#0A0F1E` | Base — the night terminal |
| `--panel` | `#111830` | Raised surfaces on midnight |
| `--amber` | `#FFB547` | Runway accent: routes, live data, CTAs |
| `--blush` | `#E8919E` | The flirty edge: vibe tags, warm copy, stamp ink |
| `--bone` | `#F4EFE6` | Boarding-pass paper — light cards on dark ground, the core tactile contrast |
| `--ink` | `#171B26` | Text on paper |
| Display | Fraunces | Editorial headlines — "Never ride alone." |
| Mono | JetBrains Mono | Flight numbers, times, money, receipts |
| Body | Inter | Everything else |

Motion is restrained: cards settle 8 px / 300 ms, split-flap flips on digits only, 2 px hover lift, the ring's slow breath — and all of it collapses under `prefers-reduced-motion`.

## 11. Screens, revised

| Route | What it becomes |
|---|---|
| `/` | Hero: flight-path lines animate into the runway node at night; two lines briefly align and continue together into the city grid. A split-flap sentence rotates real seeded facts: `2 TRAVELLERS ARRIVING NEAR GRÜNERLØKKA` · `NEXT COMPATIBLE LANDING 22:10`. Two doors — **Arriving** / **Departing** — styled as gate signage. How-it-works as three boarding-pass stubs; recent matches as a baggage-tag feed |
| `/trip` | The form *is* a boarding pass being filled in. Flight lookup or manual entry; ticket upload returns a mocked parse card to confirm/edit; destination picker with the live 1 km ring on a mini-map; flexibility slider (±15–120 min) with a live readout of how many travellers each notch unlocks; preferences as baggage tags |
| `/matches` | The convergence map (§3), board strip on top, wayfinding filters, `MAP ⇄ LIST` toggle |
| `/matches/$id` | Full pass, Route Receipt, shared-route sketch with both drop-offs and the metres between them, money math (`749 solo → 375 each`), **Join My Route**. Once Cleared: Pass-Lock, meeting point, Signals chat, Gate Check |
| `/trips` | A passport: each trip a stamped page — SEARCHING / CLEARED / BOARDING TOGETHER / ARRIVED — with timeline and a calm **Plans Changed** action |

## 12. Oslo seed data (fixtures)

| Set | Contents |
|---|---|
| Flights | ~8 arrivals in the 21:30–23:00 evening bank: DY1305 (CPH), SK272 (LHR), WF569 (BGO), AY917 (HEL), SK4489 (TRD), KL1147 (AMS), BA766 (LHR), DY631 (TOS) |
| Travellers | ~30 fictional profiles spread across those flights — names, vibes, modes, flexibility windows |
| Destinations | Real coordinates across Grünerløkka, Tøyen, Sofienberg, Majorstuen, Bislett, Frogner, St. Hanshaugen, Gamle Oslo, Sagene, Nydalen — so the ≤1 km haversine maths is real |
| Fares | Seeded approximations: fixed-price cab OSL→sentrum 749 kr, Flytoget 240 kr, Vy 124 kr — used for the split maths, labelled as estimates |

## 13. Prototype build scope (next step, after your sign-off)

One self-contained HTML file, openable straight from the chat on your phone.

| In the prototype | How |
|---|---|
| All five screens | Hash-routing simulating the TanStack routes |
| Convergence map | Stylised SVG city grid — drawn, not map tiles |
| Full matching engine | Real haversine, hard filters, weighted ranking — pure JS, unit-testable |
| Pass-Lock + Gate Check + Signals | A few seeded travellers reciprocate after a short delay so you can experience the whole ladder, including the lock animation and scripted chat replies |
| Ticket upload | File accepted client-side → mocked parse card to confirm |
| Persistence | Trip, joins, and match states in `localStorage`, hydrated safely |
| Accessibility | List view, reduced-motion support, semantic markup |

**Mocked:** reciprocation timing, chat replies, flight data, boarding-pass parsing. **Out, as agreed:** accounts, backends, payments, real OCR, real flight APIs. The TanStack Start codebase version can follow later if you want it — same data files, same matching module.

---

*Reply "go" and I'll build it exactly to this plan — or send changes and I'll revise first.*
