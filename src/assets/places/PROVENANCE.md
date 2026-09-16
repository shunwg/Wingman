# Place photography — provenance

Thirty-seven place photographs, copied byte-for-byte from the Expo prototype at
`../wingman-native/assets/photos/` (commits `2af881c` and `f474a84`). They are the
photography behind the trip, port and shared-car surfaces.

**Every one of the 37 has an unestablished source.** Nothing in the native repo records
where any individual file came from, so every row below reads `unknown — flagged`. The
subjects are evidenced; the sources are not. This file exists so that gap is visible
rather than inherited silently.

---

## Needs confirmation before public deploy

All 37 files. None may be published on a public deploy until someone who knows where they
came from either supplies a licence for it or replaces it.

### Why this is not a formality

Three things make the risk concrete rather than theoretical:

1. **They are real photographs of real, identifiable places.** Spot-checking
   `airports/CDG/fontainebleau-chateau.jpg`, `airports/OSL/opera-house.jpg` and
   `stock/lounge.jpg` shows genuine photographs — the actual Château de Fontainebleau, the
   actual Oslo Opera House. These are not generated images, so a real photographer holds a
   real copyright in each of them. (Contrast the cast portraits, which the native README
   does state are generated likenesses — see the note at the foot of this file.)
2. **Every file is exactly 640 px wide**, with heights ranging 360–1138. A fixed-width set
   with varying heights is the signature of a batch resize to web resolution, not of
   licensed originals, which arrive at 3000–6000 px. Nobody licenses a 640 px master.
3. **All EXIF and XMP metadata has been stripped.** Scanning the header of all 37 files for
   `Copyright`, `Artist`, `Creator`, camera make/model or any toolchain marker returns
   nothing at all. Whatever attribution the originals carried is gone.

Taken together: web-resolution copies of real photographs, with the attribution removed
and no record of origin. That is the profile of images to clear before publishing, not
after.

### The 37

`airports/CDG/` — `fontainebleau-chateau.jpg` · `fontainebleau-forest-road.jpg` ·
`terminal-2e-walkway.jpg`

`airports/CPH/` — `cafe-in-rain.jpg` · `nyhavn.jpg` · `terminal-exterior.jpg` ·
`terminal-interior.jpg`

`airports/LHR/` — `city-skyline-dawn.jpg` · `city-skyline-night.jpg` · `escalator.jpg` ·
`terminal-2-entrance.jpg` · `tower-bridge-dusk.jpg`

`airports/OSL/` — `apron-snow.jpg` · `city-sunset.jpg` · `opera-house.jpg` · `pier.jpg` ·
`street-crosswalk.jpg`

`airports/SIN/` — `jewel-station.jpg` · `jewel-waterfall.jpg` · `marina-bay-skyline.jpg`

`stock/` — `apron-blue-hour.jpg` · `baggage-carousel.jpg` · `black-cab-daytime.jpg` ·
`black-cab-night.jpg` · `clouds-window.jpg` · `concourse.jpg` · `departure-board.jpg` ·
`gate-dusk.jpg` · `jetbridge.jpg` · `lounge.jpg` · `passports.jpg` · `rain-on-glass.jpg` ·
`runway.jpg` · `taxi-night.jpg` · `terminal-clock.jpg` · `wayfinding.jpg` ·
`window-warm-light.jpg`

---

## What was searched, and what it turned up

The native repo was searched rather than assumed. For the record, so nobody repeats it:

| Where | Result |
|---|---|
| `git log --oneline -- assets/photos` | Two commits, `2af881c` and `f474a84`. Both add photos in bulk; neither message names a source, a photographer or a stock library. `f474a84` says only that it "adds real CDG/Fontainebleau photography"; `2af881c` describes the two-tree folder scheme and counts the assets in the bundle. |
| `git log --diff-filter=A -- assets/photos` | Same two commits — no file was ever added separately with its own message. |
| A per-file manifest | None. `find assets -name '*.md' -o -name '*.json' …` returns nothing, and `git ls-files assets` lists image files only. `src/data/photos.ts` references an `assets/README.md`, but that file does not exist in the repo. |
| `README.md`, `CLAUDE.md`, `AGENTS.md` | No photographer, library, licence name or URL. `CLAUDE.md` is a one-line `@AGENTS.md` include; `AGENTS.md` is three lines about Expo docs. |
| `LICENSE` | The stock Expo MIT licence from `create-expo-app`, covering 650 Industries' template code. Says nothing about image assets. |
| Repo-wide grep for `unsplash`, `pexels`, `getty`, `shutterstock`, `adobe stock`, `photographer`, `attribution`, `licen[cs]` | No hit anywhere in `src/`, `scripts/`, `.github/` or `.claude/`. The only matches are React's own `@license` banners inside the generated `docs/` web bundle. |
| EXIF / XMP in the files themselves | Nothing. See point 3 above. |

**The one licence statement in the native repo, quoted exactly.** `README.md` line 144,
step 2 of "Adding a new airport's photography": "Drop the licensed photos in."

That is an instruction to a future contributor about what they ought to add. It is not a
record of what these 37 files are, it names no licence, and it is not evidence that any
particular file here was licensed. It is deliberately not carried into the table below as
a source.

### How to read the columns

- **Subject** — evidenced. Taken from the filename, the native `README.md` per-folder
  descriptions (lines 124–138), and the key names in the native `src/data/photos.ts`;
  three files were confirmed by eye. Where a subject is the repo's label rather than
  something confirmed visually, it is still only a label — it says what the picture is
  meant to show.
- **Source** — `unknown — flagged` on every row, because there is no evidence to cite.
- **Licence** — `unknown — flagged` on every row, for the same reason. Not "licensed": the
  native README's aspiration is not a per-file grant.

---

## `airports/CDG/` — Paris Charles de Gaulle, and Fontainebleau

The flagship shared-car scenario. Per the native README: "Paris CDG Terminal 2E +
Fontainebleau chateau and forest road, for the shared-car scenario."

| File | Subject | Source | Licence |
|---|---|---|---|
| `fontainebleau-chateau.jpg` | Château de Fontainebleau across its lawn — confirmed by eye, a real photograph of the actual château | unknown — flagged | unknown — flagged |
| `fontainebleau-forest-road.jpg` | Road through the Fontainebleau forest (labelled) | unknown — flagged | unknown — flagged |
| `terminal-2e-walkway.jpg` | CDG Terminal 2E walkway (labelled) | unknown — flagged | unknown — flagged |

## `airports/CPH/` — Copenhagen

Per the native README: "Copenhagen Airport + Copenhagen city."

| File | Subject | Source | Licence |
|---|---|---|---|
| `cafe-in-rain.jpg` | A café in the rain (labelled) | unknown — flagged | unknown — flagged |
| `nyhavn.jpg` | Nyhavn harbour, Copenhagen (labelled) | unknown — flagged | unknown — flagged |
| `terminal-exterior.jpg` | Copenhagen Airport terminal, exterior (labelled) | unknown — flagged | unknown — flagged |
| `terminal-interior.jpg` | Copenhagen Airport terminal, interior (labelled) | unknown — flagged | unknown — flagged |

## `airports/LHR/` — London Heathrow

Per the native README: "London Heathrow + London city."

| File | Subject | Source | Licence |
|---|---|---|---|
| `city-skyline-dawn.jpg` | London skyline at dawn (labelled) | unknown — flagged | unknown — flagged |
| `city-skyline-night.jpg` | London skyline at night (labelled) | unknown — flagged | unknown — flagged |
| `escalator.jpg` | Terminal escalator (labelled) | unknown — flagged | unknown — flagged |
| `terminal-2-entrance.jpg` | Heathrow Terminal 2 entrance (labelled) | unknown — flagged | unknown — flagged |
| `tower-bridge-dusk.jpg` | Tower Bridge at dusk (labelled) | unknown — flagged | unknown — flagged |

## `airports/OSL/` — Oslo Gardermoen

Per the native README: "Oslo Gardermoen + Oslo city."

| File | Subject | Source | Licence |
|---|---|---|---|
| `apron-snow.jpg` | Snow on the apron (labelled) | unknown — flagged | unknown — flagged |
| `city-sunset.jpg` | Oslo at sunset (labelled) | unknown — flagged | unknown — flagged |
| `opera-house.jpg` | Oslo Opera House from the fjord — confirmed by eye, a real photograph of the actual building | unknown — flagged | unknown — flagged |
| `pier.jpg` | A pier (labelled) | unknown — flagged | unknown — flagged |
| `street-crosswalk.jpg` | Street crossing (labelled) | unknown — flagged | unknown — flagged |

## `airports/SIN/` — Singapore Changi

Per the native README: "Singapore Changi + the Marina Bay skyline."

| File | Subject | Source | Licence |
|---|---|---|---|
| `jewel-station.jpg` | Jewel Changi interior (labelled) | unknown — flagged | unknown — flagged |
| `jewel-waterfall.jpg` | The Rain Vortex waterfall at Jewel Changi (labelled) | unknown — flagged | unknown — flagged |
| `marina-bay-skyline.jpg` | Marina Bay skyline (labelled) | unknown — flagged | unknown — flagged |

## `stock/` — atmosphere, not tied to a named airport

Per the native README: "Atmosphere shots not tied to a named airport (a concourse, a
lounge, a departure board, a jetbridge). Reusable across any city."

| File | Subject | Source | Licence |
|---|---|---|---|
| `apron-blue-hour.jpg` | An apron at blue hour (labelled) | unknown — flagged | unknown — flagged |
| `baggage-carousel.jpg` | Baggage carousel (labelled) | unknown — flagged | unknown — flagged |
| `black-cab-daytime.jpg` | London black cab, daytime (labelled) | unknown — flagged | unknown — flagged |
| `black-cab-night.jpg` | London black cab, night (labelled) | unknown — flagged | unknown — flagged |
| `clouds-window.jpg` | Clouds from a cabin window (labelled) | unknown — flagged | unknown — flagged |
| `concourse.jpg` | Airport concourse — the Welcome hero (labelled) | unknown — flagged | unknown — flagged |
| `departure-board.jpg` | Departure board (labelled) | unknown — flagged | unknown — flagged |
| `gate-dusk.jpg` | A gate at dusk (labelled) | unknown — flagged | unknown — flagged |
| `jetbridge.jpg` | Jetbridge (labelled) | unknown — flagged | unknown — flagged |
| `lounge.jpg` | Empty airport seating in warm light — confirmed by eye, a real photograph of a real terminal | unknown — flagged | unknown — flagged |
| `passports.jpg` | Passports (labelled) | unknown — flagged | unknown — flagged |
| `rain-on-glass.jpg` | Rain on terminal glass (labelled) | unknown — flagged | unknown — flagged |
| `runway.jpg` | A runway (labelled) | unknown — flagged | unknown — flagged |
| `taxi-night.jpg` | A taxi at night (labelled) | unknown — flagged | unknown — flagged |
| `terminal-clock.jpg` | Terminal clock (labelled) | unknown — flagged | unknown — flagged |
| `wayfinding.jpg` | Wayfinding signage (labelled) | unknown — flagged | unknown — flagged |
| `window-warm-light.jpg` | Warm light through a window (labelled) | unknown — flagged | unknown — flagged |

---

## The cast portraits are a separate matter, and they are fine

`src/assets/people/` was **not** touched by this copy. The 16 portraits already in this
repo were verified byte-identical to the native repo's copies — all 16 SHA-256 digests
match, so there is one image set, not two that have drifted.

Their provenance is also on a different footing from the place photography, and better.
The native `README.md` (lines 121–122) states the portraits are "Generated likenesses,
never a real stranger's photo", and this repo's own `src/data/seed/photos.ts` says the
same in its header comment and gives the reason: no real face should appear on a fictional
profile. Their provenance is recorded where they live; it is not restated here.

The asymmetry is the thing worth noticing. Someone wrote down where the portraits came
from because a face on a fake profile is obviously a problem. Nobody wrote down where the
places came from, because a photograph of a building does not look like a problem. It is
the same problem, one step further from the eye.
