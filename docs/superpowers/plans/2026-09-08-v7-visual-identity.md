# Wingman v7 — a typeface and a photo, not a template

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`. This plan itself is the record of the brainstorming step (design audit → clarifying questions → decisions below), so no separate spec doc is required before execution — but copy this file to `docs/superpowers/plans/2026-09-08-v7-visual-identity.md` at the start of Stream 1, per the project's existing convention. Every stream ends with `npm run verify` green, `npm run lint` clean, `npm run e2e` green, `SHOOT_DARK=1 npm run shoot`, and a commit. `superpowers:verification-before-completion` before any claim that a stream is done.

**Goal:** Fix the two concrete, cited reasons the shipped app reads as a generic AI-generated template — flat system-font-only type with no real hierarchy, and a photo treatment too timid to feel premium — without reopening the product decisions (five tabs, navy/blue, "continuation not rebuild") already settled in v6, and without the app stopping being fast, native, and offline-first.

**Architecture:** No new architecture. Everything here is token/CSS/component-level, inside the existing `design/` axis (`CLAUDE.md`'s import boundaries and pure-engine rules are untouched — this stream never touches `matching/`, `privacy/`, or `stamps/`).

---

## Context — what was actually wrong, and why it's fixable without a rebuild

Two Explore passes over the live code (not the screenshots alone) found the following, quoted directly so the fix targets the real cause:

1. **There is no display typeface.** [`tokens.css:69-76`](../../../Downloads/claude%20code/44_WIngman/wingman/src/design/tokens/tokens.css) defines `--font-body` and `--font-display` as *the same* system-font stack; `.display` (`tokens.css:300-305`) is that stack at `font-weight: 700` and tighter tracking — weight is the only lever hierarchy has. Three other files (`Wordmark.tsx:5-7`, `DesignGallery.tsx:107-108`, `avatar/generate.ts:106`) still say *"Fraunces for display, Inter for interface"* — a pairing that was planned and never wired up. That's fortunate: both Fraunces and Inter are now flagged by name as overused "AI-tell" fonts (`impeccable` skill's reflex-reject list and its live antipattern detector both name them), so finishing the abandoned plan would have made the "screams AI" problem worse, not better.

2. **The card is the template the anti-slop lists warn about, for a real reason that's now working against the app.** [`PersonCard.tsx:13-28`](../../../Downloads/claude%20code/44_WIngman/wingman/src/screens/person/PersonCard.tsx) shrank the identity photo to 56px on purpose: an earlier full-photo version "worked too well: a wall of faces invites you to judge faces." That's a legitimate call for a scanning surface. But it means every list card is, literally, "bordered white rectangle + tiny circular avatar + gray pill tags" — one of the patterns the design-taste skills flag as generic — and the only full-bleed photo moments left in the app are Welcome and a Person-detail hero capped at 220px/4:3 (the reference mockup's is roughly double that).

Neither of these needs new screens or new engines. Both are token- and component-level, which is why this is a v7 polish stream, not a v6-style rebuild.

**Decisions taken (asked and answered this session):**

| Decision | Answer |
|---|---|
| Typography | **`ui-rounded` (SF Pro Rounded) for display, system stack for body.** Zero network request — stays inside `CLAUDE.md`'s "no webfont" rule — but is a real, distinct second face: Apple's own friendly-premium register (Health, Fitness, Podcasts), softer terminals than default SF Pro, which directly answers "less square." Not on any reflex-reject list because it isn't a webfont at all. |
| Photo presence | **Grow it modestly, everywhere.** The 56px circle becomes a slightly larger rounded-square "photo chip" with a soft duotone glow (colour-matched to the avatar's own generated palette) behind it — visibly more photographic, still nowhere near a dating-style photo wall. The Person-detail hero (the one screen with no "wall of faces" problem, since it's one profile opened deliberately) grows toward the mockup's proportions. |
| Flagship example scenario | **Same-flight / same-weekend / shared taxi, INSEAD-MBA-shaped.** The user's stated first customers are a ~500-person cohort (INSEAD MBAs) who are predictably at the same airport most weekends and need this to work as a taxi-share and get-to-know app from day one. Checked the domain model directly: `ride_share` is already a first-class `MeetKind` (`domain/intent.ts:30`), `taxi_rank` is already a valid `PublicPlace.kind` (`domain/guards.ts:19`), and an `INSEAD` circle already exists in seed data (`data/seed/circles.ts:16-17`). **No new domain or matching work is needed for the scenario itself** — this stream's job is to make sure it's what the redesigned surfaces actually *show* (demo data, hero example, lens ordering), not buried behind a generic conference-networking example. |
| Photography sourcing | **Real, properly-licensed photography for places; more AI-generated (never scraped-real) photos for people.** Asked directly and confirmed: airport/city/terminal/venue imagery for Welcome, Trips, and Events comes from a library that actually grants commercial-use rights (the Unsplash License — free commercial use, no attribution required) rather than arbitrary scraped search results. Any expansion of profile-photo variety stays inside the existing, documented generation method (`data/seed/photos.ts`) — never a real stranger's photo repurposed as a fake profile; see Stream 3. |

**Explicitly out of scope for this stream** (flag, don't silently build): recurring-trip / "you and 40 classmates are all flying back Sunday night" detection, group ride-coordination (splitting a fare, more than two people in one `ride_share`), any INSEAD-specific onboarding or waitlist. All of these are real product ideas the new context raises, but they're matching/domain work, not visual work, and `CLAUDE.md`'s "before any feature work → brainstorming" rule means they get their own pass if the user wants them next, not a silent bundle into a font-and-photo stream.

---

## Streams

### Stream 1 — Typography: give `.display` an actual second face

**Files:** `src/design/tokens/tokens.css`, `src/design/brand/Wordmark.tsx`, `src/design/gallery/DesignGallery.tsx`, `src/design/avatar/generate.ts`.

- Change `--font-display` (`tokens.css:69-76`) to:
  ```css
  --font-display: ui-rounded, -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  ```
  `ui-rounded` is the CSS Fonts Level 4 generic family — real spec, not a hack — that resolves to SF Pro Rounded on Apple platforms (Safari/WebKit, which is the app's actual target per `CLAUDE.md`'s "iPhone 17 Pro" device line) and falls through to the existing stack everywhere else. Zero font requests either way.
- Update the file-header comment (`tokens.css:14-16`) to describe this decision instead of the old "hierarchy from weight alone" rationale.
- Rewrite `.display` (`tokens.css:300-305`) so weight/tracking are tuned for the rounded face specifically (rounded faces usually read well slightly less bold than a geometric sans at the same size — check visually at 28px/34px against the current 700/-0.022em and adjust if it looks heavy).
- Fix the three stale comments that still promise Fraunces/Inter — replace with a one-line note pointing at this decision: `Wordmark.tsx:5-7`, `DesignGallery.tsx:107-108`, `avatar/generate.ts:106` (this one also hardcodes `font-family="Fraunces, Georgia, serif"` in an SVG string for the monogram fallback — change the literal, not just the comment, to the rounded stack's fallback chain since SVG `font-family` can't reference a CSS custom property).
- Re-shoot `home`, `person`, `welcome`, `you` at 402×874 in both themes and confirm the rounded face is actually rendering distinctly from body text before moving on — this is the one step in the whole plan with a real "did the CSS Fonts 4 keyword do anything" risk, so verify visually first.

### Stream 2 — Depth and photo treatment

**Files:** `src/design/tokens/components.css` (`.avatar`, `.avatar--circle`, `.avatar--photo`, `.pcard`), `src/design/tokens/tokens.css` (`--r-photo`, shadow tokens), `src/design/tokens/screens.css` (`.person__hero`, `.person__hero--band`), `src/screens/person/PersonCard.tsx`, `src/design/primitives/Avatar.tsx`, `src/design/avatar/palette.ts` (read-only — reuse the existing duotone pairs, don't add new ones).

- **List-card photo chip:** change the card-context avatar from a circle (`--r-pill`) to a rounded square using the currently-dead `--r-photo` token (14px) — this both fixes the "generic icon-in-a-circle" read and finally gives `--r-photo` a job. Grow it from 56px (the `md` size) to something in the 64–72px range — check `Avatar.tsx`'s existing size scale before inventing a new one; if `md` is used elsewhere for a genuinely small context, add a new size step rather than resizing `md` globally.
- **Duotone glow:** behind the photo chip, add a soft radial glow using the *same* duotone gradient pair the generated-avatar system already computed for that person (`avatar/palette.ts`'s 12 pairs) — for people with a real photo, derive the nearest duotone pair the same way the generator would have, so real photos and generated portraits get consistent card treatment. This is a few lines of CSS (a pseudo-element or wrapper `background`) plus passing the resolved duotone through as a CSS custom property per card — it should not require touching the SVG generator itself.
- **Hero vs. list card depth:** give the Home "people worth meeting" card and the moment-of-serendipity card `--shadow-lift` instead of the flat hairline border `.pcard` uses everywhere else, so the one-person hero moment reads as lifted/considered and the high-volume Discover board stays flat and scannable — hierarchy through depth as well as size, matching what the reference mockup actually does (its hero cards sit up off the page; its list rows don't).
- **Person-detail hero:** `.person__hero--band` (`screens.css:2285`) currently caps at `aspect-ratio: 4/3; max-height: 220px`. Grow toward the mockup's proportion — try `aspect-ratio: 4/5` (the *original*, un-overridden `.person__hero` rule at `screens.css:335-346` already specifies this; the `--band` override was the one that shrank it) with a taller cap, e.g. `max-height: 340px`. The page already scrolls, so a taller hero costs nothing functionally — verify the "…" menu button and scrim still read correctly against the taller photo.
- **Clean up the dead CSS this uncovers:** the `.person__name`-on-photo colour rule (`screens.css:356-359`, `color: var(--on-photo)`) is confirmed unused by the current JSX (name lives in `.person__body`, not overlaid on the photo) — either delete it or, if a future "name overlaid on photo" treatment is wanted, note that as a separate decision rather than leaving dead CSS in place silently.

### Stream 3 — Real photography, properly licensed

**Files:** `src/assets/places/` (new folder), `src/screens/onboarding/WelcomeScreen.tsx` / `screens.css` `.welcome__hero`, `src/screens/trips/TripsScreen.tsx` (destination/stay imagery), `src/screens/events/*` or `src/screens/circles/*` (event cover images, whichever component renders the "Events at your destination" cards shown in the reference mockup), `src/data/seed/photos.ts` (profile-photo variety only).

- **Where photography is thin today:** Welcome's hero is already a real (if generic-feeling) photo; Trips and Events currently show no destination/venue imagery at all (text-only rows) where the reference mockup shows a small venue/city photo per event card (e.g. "Milken Asia Summit — Marina Bay Sands, Singapore"). Confirm this gap by reading the actual current components before adding anything — don't assume the mockup's imagery is missing everywhere.
- **Sourcing method:** identify specific, relevant images (airport exteriors/interiors, city skylines matching the seeded cities, a business-school/conference-venue feel for Events) via the Unsplash API/site, which grants free commercial use under the Unsplash License. Curate a short list of specific candidate URLs per surface — actual named photos, not a vague "airport photo" placeholder — and **present the exact filenames, sources, and sizes for approval before downloading**, per standard practice for bringing any external file into the repo. This plan does not download anything itself.
- **Treatment:** apply the same scrim/gradient and desaturation treatment already established for the Welcome hero (`screens.css:1791-1804`, `filter: saturate(0.85)` + bottom fade) so new photography matches the existing restrained palette rather than introducing oversaturated stock-photo color.
- **Profile-photo variety:** if the seed cast needs more visual variety than the current 16, generate additional photorealistic headshots the same way the existing set was produced (AI-generated likenesses of people who do not exist) — expand `data/seed/photos.ts`'s roster, don't change its sourcing method.
- Do not add photography to a surface just because the mockup has it there — check against the "not doing" and "continuation not rebuild" mandates from the v6 brief first; a photo earns its place if it's identifying (which city, which venue) or emotionally load-bearing (Welcome's hero), not decorative.

### Stream 4 — Make the flagship scenario what the app actually shows

**Files:** `src/data/seed/*` (read the existing demo/seed content before changing anything — do not invent new people or circles, retarget existing ones), `src/screens/home/HomeScreen.tsx`, `src/screens/discover/BoardFilters.tsx` (lens ordering only), any onboarding/demo copy that currently illustrates the product with a generic example.

- Audit which seeded demo scenario currently plays first when a new user tries the demo (`#/demo`) or sees Home's example state, and confirm/adjust it so the flagship illustration is a same-flight-or-same-weekend, ride-share-shaped example (using the *existing* `ride_share` MeetKind and `taxi_rank` place, not new ones) rather than a generic conference-networking one. The INSEAD circle already in seed data (`data/seed/circles.ts:16-17`) is the natural anchor — check it's actually reachable from the demo path, not just present in the data.
- Confirm the "Same flight" / "Same airport" lenses (`BoardFilters.tsx`'s `LENSES` array, added in v6) are ordered first among the lens chips, since for this audience they're the primary use case, not a niche filter.
- This stream is content/ordering only — **no changes to `matching/`, `domain/intent.ts`, or `domain/guards.ts`**. If the audit finds the ride-share/taxi scenario is *not* well-supported by existing seed data or copy, stop and report that as a finding rather than expanding scope to fix it here.

### Stream 5 — Anti-tell pass

**Files:** `src/design/tokens/tokens.css` (`--canvas`/surface tokens), full-repo grep of `src/design/` and `src/screens/`.

- Check the app's actual canvas/background token value against the specific banned range the audit surfaced (`impeccable` skill: warm-neutral OKLCH L 0.84–0.97, C < 0.06, hue 40–100 reads as "cream" regardless of name) — if it falls inside that band, either justify it explicitly (Wingman's brief called for "warm neutral," which is a deliberate choice, not a reflex — note that reasoning in the token comment) or nudge it outside the band if it reads as generic.
- Grep for the other checkable tells from the audit that are plausible in this codebase even though none were confirmed present yet: side-stripe accent borders on cards, an icon-tile-stack pattern (small rounded-square icon above a heading), a hero-eyebrow-chip (tiny tracked label above an oversized headline), gradient text. Fix anything found; this is a verification step, not an assumed-necessary rewrite.

### Stream 6 — Verify and ship

- `npm run verify` · `npm run lint` · `npm run e2e` (16 specs) · `npm run personas:flows` (6 flows) all green.
- `SHOOT_DARK=1 npm run shoot` — review every screen at 402×874 in both themes, specifically checking: the rounded display face is visually distinct from body text; the photo chip reads as a photograph, not an icon; the Person hero doesn't clip awkwardly at the new height; nothing from Stream 5's grep survived.
- Commit per stream as usual; merge `wingman-v7` → fast-forward `main` → push → confirm the Pages deploy is green, the same way v6 was closed out.

---

## Verification

1. `npm run verify` — typecheck · pure typecheck · boundaries · dataset · all tests, exit 0. (This stream touches zero files under `tsconfig.pure.json`'s scope, so a failure here would mean something leaked into `matching/`/`privacy`/`domain` by mistake — treat it as a boundary violation, not a flaky test.)
2. `npm run lint` clean.
3. `npm run e2e` — the 16 existing specs green. A pure CSS/token change breaking a Playwright spec means a selector or visible-text assertion collided with a class rename — check before assuming the spec is stale.
4. Visual: `SHOOT_DARK=1 npm run shoot`, reviewed against the two decisions above, not just "does it look nicer" — does `.display` visibly differ from body text at the same size; is the photo chip visibly bigger and squarer than before; does the flagship Home/demo scenario show the ride-share/same-flight case.
5. Rule 7 check unaffected (`grep -rn "score" src/screens src/design` — this stream never touches ranking).
