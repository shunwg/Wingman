# Place photography — provenance

Thirty-seven place photographs, copied byte-for-byte from the Expo prototype at
`../wingman-native/assets/photos/` (commits `2af881c` and `f474a84`, copied here in
`f58cc1e`). All 37 re-verified byte-identical to the native copies by SHA-256. They are the
photography behind the trip, port and shared-car surfaces.

## Verdict

**These are real photographs taken by people, not generated images. That is established, not
guessed.** Which library they were licensed from is **probably Unsplash**, on a sourcing
decision recorded in this repo six days before the files existed. **Which individual
photographer took any one of them is unknown, and no licence grant exists per file.**

Three separate tests carry the first conclusion, and they agree:

1. **This repo's AI images declare themselves in their own bytes. None of these 37 does.**
   `../hero-terminal.jpg` carries a cryptographically signed C2PA manifest naming OpenAI's
   image model; all 16 cast portraits carry the IPTC `trainedAlgorithmicMedia` declaration.
   A full-byte scan of all 37 place files finds no such marker — none at all.
2. **The bytes show many origins normalised by one resize, not one generator.** Seven
   distinct ICC colour-profile identities across 37 files, in four different working colour
   spaces including ProPhoto RGB and Adobe RGB — spaces a photographer chooses in a raw
   editor, which a generation API does not emit.
3. **The pictures contain correct, checkable detail.** Real airline codes including the
   counterintuitive ones, two airlines that went bust in 1992 and 2002 with period-correct
   logos, correct Chinese/Malay/Japanese signage, the real official name of Heathrow
   Terminal 2, a real restaurant's name legible at Nyhavn. Generated images garble exactly
   this.

Confidence: **high** on "real photographs" — the three tests are independent and the first is
a control drawn from this same repo. **Low-to-moderate** on Unsplash as the library: the
decision is documented, but the step that was supposed to record it per file never ran.

**What this does not clear.** A real photographer holds copyright in each of these. Nothing
here is a licence. The uniform 640 px width and stripped EXIF mean whatever attribution the
originals carried is gone, and we cannot reconstruct it from the files. They should be
cleared or replaced before a public deploy — see [Before a public
deploy](#before-a-public-deploy).

---

## Test 1 — the repo's own AI images declare themselves; these do not

This is the strongest evidence, because the control group is in this same repository and was
made by the same hands.

**`../hero-terminal.jpg` is AI-generated, and says so in a signed manifest.** It carries a
29,096-byte `APP11` JUMBF segment — a C2PA "Content Credentials" manifest. Decoded, it reads:

| C2PA field | Value |
|---|---|
| `claim_generator_info.name` | `OpenAI Media Service API` |
| `c2pa.actions.v2` → `action` | `c2pa.created`, `when: 2026-08-15T00:00:00Z` |
| → `softwareAgent` | `name: gpt-image`, `version: 2.0` |
| → `digitalSourceType` | `http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia` |
| further actions | `c2pa.converted`, `c2pa.watermarked.unbound` (it carries an invisible watermark) |
| signing certificate | `OpenAI OpCo, LLC` / `OpenAI Media Service`, issued by `SSL.com C2PA ICA R1 2025` |
| timestamp authority | `OpenAI TSA Leaf`, countersigned `20260815132649.758281Z` |
| spec | `c2pa specVersion 2.2.0`, `org.contentauth.c2pa_rs 0.79.2` |

**All 16 cast portraits carry the same declaration in a lighter form.** Each has a 422-byte
`APP1` XMP packet whose entire payload is one assertion:

```
Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"
```

That is the machine-readable IPTC term for "made by a trained algorithm". It independently
confirms what `src/data/seed/photos.ts` already claims in prose, which is a pleasant result
in itself: the comment was true.

**The 37 place files contain none of it.** Scanning the complete bytes of every file — not
just the header — for each of `trainedAlgorithmicMedia`, `c2pa`, `jumb`, `xpacket`,
`xmpmeta`, `digitalSourceType`, `openai`, `gpt-image`, `dall`, `Midjourney`, `Stability`,
`firefly`, `Flux`, `stable-diffusion`, `unsplash`, `pexels`, `getty`: **zero hits across all
37 files.**

The logic matters more than the absence. In this repository, images that were generated are
marked as generated, twice over and by two different mechanisms. The place photographs
carry neither mark. Absence of a marker is weak evidence in general; absence of the marker
that this project's own generated images all carry is strong.

> **A correction to the previous pass.** It reported that scanning the 37 for `Copyright`,
> `Artist` or `Creator` "returns nothing at all." That is false. **32 of the 37 contain a
> `Copyright` string**, and one contains `Adobe`. They are ICC colour-profile boilerplate —
> `Copyright (c) 1998 Hewlett-Packard Company`, `Copyright 1999 Adobe Systems Incorporated`,
> `Copyright Apple Inc., 2015`, `Copyright (c) Eastman Kodak Company, 1999, all rights
> reserved.` None is photographer attribution, so the previous pass's *conclusion* survives.
> But it reached it by not looking at the ICC profiles, and the ICC profiles turn out to be
> the second-best evidence in the whole exercise.

## Test 2 — the bytes show many origins, one resize

A single image-generation API produces one byte signature. The portraits demonstrate exactly
that: all 16 are baseline JPEG, JFIF 1.01 at density 1×1, **zero** ICC profile, and share one
identical quantization-table set. One process, one fingerprint.

The 37 places do not look like that. They share a *downstream* pipeline and differ
*upstream* — which is the signature of many photographs collected from many people and then
put through one resize.

**What all 37 share** (the one resize): exactly 640 px wide, heights 360–1138 · progressive
JPEG (`SOF2`) · 4:2:0 chroma subsampling · 72 dpi · no EXIF · an ICC profile preserved.
Preserving ICC while discarding EXIF and emitting progressive JPEG at a caller-specified
width is what a stock-library delivery CDN does.

**What differs — seven ICC identities, four working colour spaces:**

| ICC profile | Bytes | Files | What it implies |
|---|---|---|---|
| `sRGB IEC61966-2.1` (`Lino`/`IEC `/`HP  `) | 3144 | 28 | The standard sRGB profile — the common case |
| Apple (`appl`/`APPL`) | 536 | 3 | Apple capture/export |
| Apple `Display P3` | 548 | 1 | Apple wide-gamut capture (iPhone) |
| Kodak `ProPhoto RGB` (`KCMS`/`KODA`) | 940 | 2 | A raw-editing working space |
| `Adobe RGB (1998)` (`ADBE`) | 560 | 1 | A raw-editing working space |
| Google (`GOOG`) | 596 | 1 | Google/Pixel processing |
| LittleCMS (`lcms`) | 748 | 1 | An open-source conversion step |

ProPhoto RGB and Adobe RGB are not defaults anybody stumbles into; they are deliberate
choices made in Lightroom or Capture One by someone processing raw files. Display P3 comes
off an iPhone. Finding four different working spaces across 37 images is a photographers'-
workflow fingerprint, and it is per-file, not per-set.

**Two encoder signatures underneath, neither matching the AI set:**

| Group | Quantization | Structure | Files |
|---|---|---|---|
| **E1** | `q0` begins `6,4,4,6,9,15,19,23` | two `DQT` segments, two `DHT`, JFIF **1.02** | 30 |
| **E2** | `q0` begins `3,4,5,6,9,13,19,29` | one `DQT` segment, one `DHT`, JFIF **1.01** | 7 |
| *(AI set, for contrast)* | `q0` begins `8,6,5,8,12,20,26,31` | baseline `SOF0`, four `DHT`, no ICC | 17 |

E2 is the higher-quality table and all seven of its members are portrait-orientation. Two
delivery settings, or two download batches, from the same kind of source. Either way: not one
generator, and not the generator that made the hero and the portraits.

## Test 3 — the pictures contain correct detail

Nine files were read directly, spanning all five airports and `stock/`. The distinguishing
question is whether the specific, checkable detail is *right*. It is — including in the
places where a generated image reliably fails.

**`stock/departure-board.jpg` — the single most diagnostic file.** A mechanical split-flap
board, every character crisp. Column headers are in **Dutch** (`naar` / `to`, `pier/nr`,
`pier/gate`), so a Netherlands airport, almost certainly Schiphol. The rows read:

```
16.45  SWISSAIR  SR  793  ZURICH        17.30  FINNAIR    AY  846  HELSINKI
16.45  LOT       LO  266  WARSCHAU      17.30  Lufthansa  LH   93  HAMBURG
16.55  AIR FRANCE AF 915  PARIS         18.25  SAS        SK  556  GOTHENBURG
17.05  KLM       KL  329  PARIS         18.45  DAN-AIR    DA  797  TEES SIDE
17.10  SAS       SK  558  STOCKHOLM     18.55  DAN-AIR    DA  787  BRISTOL
17.10  KLM       KL  161  GLASGOW       19.00  British airways BA 931 MANCHESTER
17.15  KLM       KL  173  COPENHAGEN
```

Every IATA designator is correct, **including Finnair's `AY`** — a code with no relationship
to the airline's name (it is from *Aero O/Y*) and precisely the kind of detail a generator
substitutes with a plausible-looking `FI`. Two of the carriers no longer exist: **Dan-Air**
(collapsed 1992) and **Swissair** (collapsed 2002), both with period-correct logo artwork.
`TEES SIDE` is Teesside Airport, a genuine Dan-Air destination. `WARSCHAU` is the
German/Dutch exonym for Warsaw, correct for the board's language. This is a real historical
photograph, and it is internally consistent to a degree no generator achieves.

**`stock/wayfinding.jpg`** — an illuminated `Arrival` sign with a baggage glyph, plus three
scripts: `入境` (Chinese, *immigration*), `Ketibaan` (Malay, *arrival* — correctly spelled),
`到着` (Japanese, *arrival*). All glyphs well-formed and correct. That language set points to
Singapore or Malaysia, consistent with Changi. Generated CJK text is the most reliable AI
tell there is, and there is none here.

**`airports/LHR/terminal-2-entrance.jpg`** — the fascia reads exactly **`Terminal 2 | The
Queen's Terminal`**, with the `Heathrow` wordmark set below and right. That is the real
official name of LHR T2, opened 2014. Digital panels beside it read `ON SALE NOW` and
`WIRED`. Correct roof trusses.

**`airports/OSL/opera-house.jpg`** — Snøhetta's Operahuset: the sloping white marble roof out
of the fjord, the canted glass lantern, the aluminium stage tower, Bjørvika behind. Floating
in the water in front is Monica Bonvicini's **"She Lies"** — which is installed in exactly
that position in the harbour basin. Correct, and specific.

**`airports/CPH/nyhavn.jpg`** — Nyhavn's gabled colour terrace and wooden boats, with
**`HYTTEFADET`** legible on a frontage: the real fish restaurant at Nyhavn 9.

**`airports/SIN/jewel-waterfall.jpg`** — the Rain Vortex: toroidal glass-and-steel gridshell,
oculus, terraced Forest Valley planting, and the **Changi Skytrain viaduct crossing directly
in front of the falls**, which is how Jewel is actually built.

**`airports/SIN/marina-bay-skyline.jpg`** — Marina Bay Sands' three towers with the SkyPark,
the Singapore Flyer lit red/white, the ArtScience Museum's lotus, in a correct sightline from
Marina East. A long-exposure night frame: smoothed water, drawn-out cloud.

**`airports/CDG/fontainebleau-chateau.jpg`** — the Château's correct façade rhythm and tall
brick chimneys above the parterre, with dry patchy late-summer grass and yellow wildflowers.

**And the contrast, which is the point.** `../hero-terminal.jpg` — the file we *know* is
generated — contains **no legible text anywhere** and depicts **no identifiable place**: a
generic night curbside, yellow taxis, illegible signage, an indistinct badge on the nearest
car. That is what this set would look like if it were generated. It does not look like that.

---

## What predates today, and what it says

Per the instruction to prefer evidence that predates today over a judgement made today, here
is the recorded timeline. Two things in it were missed entirely by the previous pass.

| Date | Event | Bearing on provenance |
|---|---|---|
| **2026-08-15** | `hero-terminal.jpg` generated by OpenAI `gpt-image` 2.0 (per its own signed C2PA) | Dates the AI set precisely |
| **2026-08-16** | `3a03298` *"Real portraits, and four more people"* adds the 16 portraits **and** `hero-terminal.jpg` | The hero and the portraits arrive together, from one generator |
| **2026-09-06** | `7fcbe5f` commits `docs/superpowers/plans/2026-09-08-v7-visual-identity.md` | **Records the sourcing decision.** See below |
| **2026-09-12** | native repo created; `2af881c` adds 34 photos, `f474a84` adds the 3 CDG files | The 37 first exist, six days after the decision |
| **2026-09-16** | `f58cc1e` copies all 37 here, byte-identical | This repo's copies |

**The decision, quoted from the v7 plan (2026-09-06), which is the only record of intent
anywhere in either repo:**

> "Real, properly-licensed photography for places; more AI-generated (never scraped-real)
> photos for people. […] airport/city/terminal/venue imagery […] comes from a library that
> actually grants commercial-use rights (the Unsplash License — free commercial use, no
> attribution required) rather than arbitrary scraped search results."

Its Stream 3 also set a safeguard: "present the exact filenames, sources, and sizes for
approval before downloading", and noted "This plan does not download anything itself."

**Why this is worth something.** It predates the files by six days. It names a specific
library with a specific licence. Unsplash's delivery CDN behaviour — caller-specified width,
progressive JPEG, EXIF stripped, ICC preserved — matches what Test 2 found in the bytes. And
the plan's split treatment (generated for people, real for places) is exactly the split the
bytes independently confirm. That is a documented intention corroborated by physical
evidence, which is a good deal better than a guess made today.

**Why it is not enough.** There is **no v7 Stream 3 commit.** Streams 1+2, 4 and 5 all
landed (`7fcbe5f`, `fe96d60`, `e45a0b7`); the photography stream did not. The files instead
appeared in the *native* repo six days later, and the approval step that was supposed to
capture filenames and sources left no artefact — no URL list, no photographer names, no
manifest, in either repo's history. So the decision tells us what was *meant* to happen. It
cannot tell us that it happened for file 23 of 37. Recording "Unsplash" as this set's source
would be upgrading an intention into a record, which is the one thing this file must not do.

**Everything searched for a generator or a download, and found empty.** Full history of both
repos (`git log --all`, all 7 branches, `--diff-filter=D` for deleted files, `git stash list`
— empty in both, `git fsck --lost-found` — three dangling commits, all screen/docs work, no
assets). No image-fetch script exists: `wingman/scripts/` holds only airport-data and build
tooling, and the one `fetch()` in it pulls the OurAirports CSV (public domain).
`wingman-native/scripts/` holds one path-fixing script. `.env.example` lists three *flight*
providers and no image service; there is no `.env` in either repo. No deleted manifest ever
existed.

## What is still unknown, and what would settle it

Per file, the unknown is the same: **which photographer, and under which licence grant.**

What would settle it, none of which this environment can do:

- **A reverse image search per file** (Google Lens, TinEye, or Unsplash's own search). This
  is the one thing that would convert "probably Unsplash" into a named photo ID and
  photographer for each file. **This environment has no network access**, so it was not
  attempted and must not be simulated.
- **Whoever ran the download.** The v7 plan required an approval list of exact filenames and
  sources. If that list survives outside git — in a terminal scrollback, a chat log, a
  browser history — it is the per-file answer, and it predates everything here.
- **Re-acquiring from source.** Searching Unsplash for these subjects and re-downloading the
  matching originals would produce files with known IDs and licences, and would also fix the
  640 px ceiling. For anything going in front of the public this is likely cheaper than
  proving the existing copies' lineage.

---

## The manifest

Every one of the 37 is listed by name. Evidence that is identical is cited by code rather
than restated, because restating the same sentence 37 times would obscure the places where
the evidence genuinely differs.

**Evidence codes**

| Code | Meaning |
|---|---|
| `B` | **Byte-level, all 37.** No AI/generator marker anywhere in the full bytes; 640 px wide; progressive; 4:2:0; no EXIF; ICC preserved. Test 1 + Test 2. |
| `E1` / `E2` | Encoder group (Test 2). `E1` = 30 files, `E2` = 7 files, tables differ. |
| `sRGB` `P3` `ProPhoto` `AdobeRGB` `GOOG` `lcms` `appl` | That file's own ICC profile — its individual upstream fingerprint. |
| `V` | **I read this image and verified named detail**, quoted in Test 3. |
| `L` | Subject is the repo's label only (filename + native README folder note + `data/places.ts` key). Not visually confirmed. |

**Origin** is what the file *is*. **Source** — which library, which photographer — is
`unknown` for all 37 and is not repeated per row; see [What is still
unknown](#what-is-still-unknown-and-what-would-settle-it).

### `airports/CDG/` — Paris Charles de Gaulle, and Fontainebleau

| File | Subject | Origin | Evidence | Confidence |
|---|---|---|---|---|
| `fontainebleau-chateau.jpg` | Château de Fontainebleau across the parterre | Real photograph | `B` `E1` `sRGB` `V` — correct façade rhythm, tall brick chimneys, dry late-summer lawn | Origin **established** · subject **established** |
| `fontainebleau-forest-road.jpg` | Road through the Fontainebleau forest | Real photograph | `B` `E1` `sRGB` `L` | Origin **established** · subject **probable** |
| `terminal-2e-walkway.jpg` | CDG Terminal 2E walkway | Real photograph | `B` `E1` `appl` (Apple, 536 B) `L` | Origin **established** · subject **probable** |

### `airports/CPH/` — Copenhagen

| File | Subject | Origin | Evidence | Confidence |
|---|---|---|---|---|
| `cafe-in-rain.jpg` | A café in the rain | Real photograph | `B` `E1` `sRGB` `L` | Origin **established** · subject **probable** |
| `nyhavn.jpg` | Nyhavn, Copenhagen | Real photograph | `B` `E1` `sRGB` `V` — `HYTTEFADET` legible, the real restaurant at Nyhavn 9 | Origin **established** · subject **established** |
| `terminal-exterior.jpg` | Copenhagen Airport, exterior | Real photograph | `B` `E1` `sRGB` `L` | Origin **established** · subject **probable** |
| `terminal-interior.jpg` | Copenhagen Airport, interior | Real photograph | `B` `E1` `sRGB` `L` | Origin **established** · subject **probable** |

### `airports/LHR/` — London Heathrow

| File | Subject | Origin | Evidence | Confidence |
|---|---|---|---|---|
| `city-skyline-dawn.jpg` | London skyline at dawn | Real photograph | `B` `E1` `sRGB` `L` | Origin **established** · subject **probable** |
| `city-skyline-night.jpg` | London skyline at night | Real photograph | `B` `E1` `sRGB` `L` | Origin **established** · subject **probable** |
| `escalator.jpg` | Terminal escalator | Real photograph | `B` `E1` `sRGB` `L` | Origin **established** · subject **probable** |
| `terminal-2-entrance.jpg` | Heathrow T2 entrance | Real photograph | `B` `E1` `GOOG` (Google, 596 B) `V` — reads `Terminal 2 \| The Queen's Terminal` + `Heathrow`, the real official name | Origin **established** · subject **established** |
| `tower-bridge-dusk.jpg` | Tower Bridge at dusk | Real photograph | `B` `E1` `AdobeRGB` (560 B — a raw-editor working space) `L` | Origin **established** · subject **probable** |

### `airports/OSL/` — Oslo Gardermoen

| File | Subject | Origin | Evidence | Confidence |
|---|---|---|---|---|
| `apron-snow.jpg` | Snow on the apron | Real photograph | `B` `E1` `lcms` (748 B) `L` | Origin **established** · subject **probable** |
| `city-sunset.jpg` | Oslo at sunset | Real photograph | `B` `E1` `sRGB` `L` | Origin **established** · subject **probable** |
| `opera-house.jpg` | Oslo Opera House from the fjord | Real photograph | `B` `E1` `sRGB` `V` — correct Snøhetta geometry; Bonvicini's "She Lies" in its real position | Origin **established** · subject **established** |
| `pier.jpg` | A pier | Real photograph | `B` `E1` `sRGB` `L` | Origin **established** · subject **probable** |
| `street-crosswalk.jpg` | Street crossing | Real photograph | `B` `E1` `sRGB` `L` | Origin **established** · subject **probable** |

### `airports/SIN/` — Singapore Changi

| File | Subject | Origin | Evidence | Confidence |
|---|---|---|---|---|
| `jewel-station.jpg` | Jewel Changi interior | Real photograph | `B` `E1` `sRGB` `L` | Origin **established** · subject **probable** |
| `jewel-waterfall.jpg` | The Rain Vortex, Jewel Changi | Real photograph | `B` `E1` `ProPhoto` (Kodak, 940 B — a raw-editor working space) `V` — correct gridshell + Skytrain viaduct crossing the falls | Origin **established** · subject **established** |
| `marina-bay-skyline.jpg` | Marina Bay skyline at night | Real photograph | `B` `E2` `sRGB` `V` — MBS, Singapore Flyer, ArtScience Museum in correct sightline; long exposure | Origin **established** · subject **established** |

### `stock/` — atmosphere, not tied to a named airport

| File | Subject | Origin | Evidence | Confidence |
|---|---|---|---|---|
| `apron-blue-hour.jpg` | An apron at blue hour | Real photograph | `B` `E1` `sRGB` `L` | Origin **established** · subject **probable** |
| `baggage-carousel.jpg` | Baggage carousel | Real photograph | `B` `E1` `sRGB` `L` | Origin **established** · subject **probable** |
| `black-cab-daytime.jpg` | London black cab, daytime | Real photograph | `B` `E1` `appl` (Apple, 536 B) `L` | Origin **established** · subject **probable** |
| `black-cab-night.jpg` | London black cab, night | Real photograph | `B` `E1` `sRGB` `L` | Origin **established** · subject **probable** |
| `clouds-window.jpg` | Clouds from a cabin window | Real photograph | `B` `E2` `ProPhoto` (Kodak, 940 B) `L` | Origin **established** · subject **probable** |
| `concourse.jpg` | Airport concourse — the Welcome hero | Real photograph | `B` `E2` `sRGB` `L` | Origin **established** · subject **probable** |
| `departure-board.jpg` | Split-flap departure board — **a Dutch airport, almost certainly Schiphol, and historical** (Swissair, Dan-Air) | Real photograph | `B` `E1` `sRGB` `V` — see Test 3; every IATA code correct incl. Finnair `AY`; two defunct carriers with period logos; Dutch headers | Origin **established** · subject **established, and the repo's label understates it** |
| `gate-dusk.jpg` | A gate at dusk | Real photograph | `B` `E1` `appl` (Apple, 536 B) `L` | Origin **established** · subject **probable** |
| `jetbridge.jpg` | Jetbridge | Real photograph | `B` `E1` `sRGB` `L` | Origin **established** · subject **probable** |
| `lounge.jpg` | Terminal seating in warm light | Real photograph | `B` `E1` `P3` (Apple Display P3, 548 B — iPhone capture) `L` | Origin **established** · subject **probable** |
| `passports.jpg` | Passports | Real photograph | `B` `E2` `sRGB` `L` | Origin **established** · subject **probable** |
| `rain-on-glass.jpg` | Rain on terminal glass | Real photograph | `B` `E1` `sRGB` `L` | Origin **established** · subject **probable** |
| `runway.jpg` | A runway | Real photograph | `B` `E2` `sRGB` `L` | Origin **established** · subject **probable** |
| `taxi-night.jpg` | A taxi at night | Real photograph | `B` `E2` `sRGB` `L` | Origin **established** · subject **probable** |
| `terminal-clock.jpg` | Terminal clock | Real photograph | `B` `E1` `sRGB` `L` | Origin **established** · subject **probable** |
| `wayfinding.jpg` | Arrival signage — **Singapore or Malaysia, consistent with Changi** | Real photograph | `B` `E1` `sRGB` `V` — `Arrival` + `入境` + `Ketibaan` + `到着`, all correct | Origin **established** · subject **established** |
| `window-warm-light.jpg` | Warm light through a window | Real photograph | `B` `E2` `sRGB` `L` | Origin **established** · subject **probable** |

**Tally.** 37 files. Origin (real photograph, not generated): **37 established**. Subject:
**9 established** by direct reading, **28 probable** from the repo's own labels. Source
(library and photographer): **0 established, 37 unknown** — Unsplash probable for the set on
documented intent, unproven for any individual file.

---

## Before a public deploy

The honest position is narrower than "flagged" but not clear:

- **Real photographs mean a real copyright holder.** The generated hypothesis was worth
  testing precisely because, had it been true, there would be no third-party copyright to
  clear. It is not true. Someone owns each of these, and we cannot name them.
- **The documented intent is a licence that would cover this use.** The Unsplash License
  grants free commercial use with no attribution required, which is why the plan chose it.
  If the download did follow the plan, there is nothing to fix. That is a real possibility,
  corroborated by the bytes — but it is not a record, and a licence you cannot evidence is
  not much use if anyone asks.
- **The cheapest route to certainty is re-acquisition, not archaeology.** Re-downloading the
  same subjects from a library with the IDs recorded this time gives a per-file licence *and*
  lifts the 640 px ceiling, which is a low resolution for a hero image on a modern phone
  anyway. Proving the lineage of the existing copies needs a reverse image search per file.
- **One weaker, separate concern.** These depict real, identifiable places and, in several,
  identifiable people at a distance (the Heathrow and Jewel frames show passengers).
  Property and personality rights are a different question from copyright, generally
  permissive for public exteriors, and not cleared by a stock licence in every jurisdiction.
  Low risk, worth one line, not worth a workstream.

## The hero and the portraits, for comparison

Both are in better shape than the places, and now for a documented reason rather than a
stated one.

**`../hero-terminal.jpg` is AI-generated: OpenAI `gpt-image` 2.0, created 2026-08-15, per a
signed C2PA manifest in the file.** No third-party copyright to clear. This was not previously
recorded anywhere — the v4 plan references the file as "real images not fake screenshots"
without knowing what it was. Worth noting: it contains no legible text and no identifiable
place, which is exactly why it reads as generic, and it also carries an unbounded invisible
watermark (`c2pa.watermarked.unbound`).

**`../hero-terminal.webp` has lost that provenance.** The 1200×900 WebP derivative — the
bundle-size optimisation the v4 plan asked for — carries no C2PA, no XMP, no ICC, nothing. The
conversion silently discarded the one artefact that proved where the image came from. A small
lesson with a general shape: provenance does not survive a pipeline unless the pipeline is
asked to carry it, and the deployed asset is the one that lost it.

**The 16 portraits in `../people/` are confirmed AI-generated by their own metadata**, each
carrying the IPTC `trainedAlgorithmicMedia` declaration, which corroborates the prose claim in
`src/data/seed/photos.ts`. They share their encoder signature with the hero, so one generator
made all 17. All 16 remain byte-identical to the native repo's copies.

**The asymmetry the previous pass noticed is real, and its reading was half right.** Someone
recorded where the portraits came from because a face on a fake profile is obviously a
problem, and nobody recorded where the places came from because a photograph of a building
does not look like one. But the generated images did not rely on that note: they carry their
provenance in their own bytes, because the tool that made them puts it there. The photographs
do not, because the pipeline that resized them took it out. The gap is not only that nobody
wrote it down — it is that for real photographs, writing it down at download time is the
*only* chance you get.
