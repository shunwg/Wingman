# WS7 — Discover density and professional depth

> Scoped in `2026-09-05-wingman-v4.md` § WS7. Cites: C2 C4 C5 V1–V4 J3.

## Tasks

1. **Two densities** — `BoardFilters.layout: 'feed' | 'row'` (unpersisted, like every filter); a segmented toggle in the filter bar; `PersonCard layout="row"` on the board. Scan, then read.
2. **Sticky filters** — the filter bar sticks under the header while the board scrolls.
3. **Industry** — chips for the industries present on the board (top five by count); `BoardFilters.industry`. `lookingFor` stays at rung 1 by default (V4); the owner can move it with the toggle in task 6.
4. **Later** — `saved: PersonId[]`, persisted; a bookmark on the card footer and the profile; a **Saved** chip on the board that shows only saved people (across trips).
5. **Custom line** — a 240-character field beside the four openers on the profile; the request carries whichever was chosen.
6. **Show early** — Edit your card gains three switches that write `privacy.disclosure`: full name before a yes (`nameEarly`), work details only once meeting (`professionalLate`), bio only once meeting (`bioLate`). The ladder already honours them; nothing else changes.
7. **Contact card** — in a meet room, the other person at the accepted rung: full name, links released by the ladder, and **Save contact** (a `text/vcard` file built from what the ladder released — never more).
8. **The sentence leads** — profile hero shrinks to a 40 % band; name over it; headline first below (J3).
9. **Deferred to WS9's log** — `AudienceRule.excludeDomains` (C5) needs a new facet through segments and census; recorded as an open finding, not built here.
10. **Tests** — `board.filters.test.ts` (row/feed does not change membership; industry narrows; saved shows only saved), `vcard.test.ts` (pure builder escapes and folds), `e2e/discover.spec.ts` (toggle rows, filter by industry, save one, Saved shows one, custom line lands on the request).

## Exit

Row/feed toggle, industry filter, saved list, custom line, contact card at the accepted rung, the profile led by the sentence. `verify`, `lint`, `e2e` green.
