# CLAUDE.md — Wingman

Meet people worth meeting, around the way you already travel.

Someone on your flight, in your terminal during a layover, or landing in the same city
tonight — for a coffee at the gate, a shared ride into town, dinner, or a business
introduction. It reads like a premium dating app and it is honestly social *and*
professional. It is never a dating app that pretends otherwise, and it never pretends
to be only a networking tool.

---

## The four swappable axes

The whole codebase is arranged so these can each be changed without touching the
others. This is the point of the folder layout — please do not collapse it.

| Axis | Folder | Change this when |
|---|---|---|
| (a) Design | `src/design/` | Restyling anything. Tokens, primitives, patterns, the avatar generator, motion. |
| (b) Interface | `src/screens/` | Adding or reworking a surface. One folder per screen area; logic lives in that area's `use*.ts` hook. |
| (c) Matching | `src/matching/` | Changing who appears and in what order. |
| (d) Approval stamps | `src/stamps/` | Adding or altering a verification provider. |

Plus `src/privacy/` — a fifth pure engine, and the subtlest code in the repo.

### Import boundaries — enforced, not suggested

| Folder | May import | May NOT import |
|---|---|---|
| `design/` | `@domain` (types), `@lib` | screens, matching, privacy, stamps, state, providers |
| `screens/` | everything, but only via each engine's public `index.ts` | engine internals |
| `matching/` | `@domain`, `@privacy` (public API), `@lib` | react, DOM, screens, state, providers |
| `privacy/` | `@domain`, `@lib` | react, DOM, screens, state, **matching** |
| `stamps/` | `@domain`, `@lib`, `@providers` | react, screens, design |

Two mechanisms keep this honest:

- **`tsconfig.pure.json`** omits the `DOM` lib and covers `domain/ matching/ privacy/
  stamps/ lib/`. Reaching for `window`, `document`, `localStorage` or `fetch` in an
  engine is a type error. Run `npm run typecheck:pure`.
- **`eslint.config.js`** carries the cross-folder import rules, bans `Date.now()` and
  `Math.random()` inside the engines, and bans provider-id string literals in screens.

## Rules that are load-bearing

Break any of these and something in the privacy model quietly stops being true.

1. **Screens and components take `RedactedPerson`, never `Person`.** `Person` is
   reachable from exactly two places: the owner's own profile slice, and
   `privacy/redact.ts`. If a screen needs a field the ladder withholds, change the
   ladder — do not reach around it.
2. **Never persist derived state.** Candidate lists, audience reports and visibility
   verdicts are recomputed on read. A cached match list is a privacy incident waiting
   to happen: a policy change has to invalidate visibility *instantly*, and it does,
   as long as nothing stale is stored.
3. **Every count crossing into the UI goes through `lib/bucket.ts`.** Exact small
   numbers deanonymise. "2 people are hidden from you" on a four-passenger flight
   identifies both of them.
4. **Time is UTC in the domain, local only at the render edge.** Airport zones are
   derived from coordinates at build time. `npm run build:data` fails if any airport
   lacks one.
5. **All writes to requests / meets / ratings go through the FSM tables in
   `state/machines/`.** They throw on illegal transitions rather than accepting a bad
   status.
6. **Meets happen on public ground.** `PublicPlace.isPublicGround` is a literal `true`
   and `makePublicPlace()` is the only constructor. A private address cannot be
   represented by the type.
7. **The ranking score is ordering only.** It is never rendered and never returned to
   the user, who sees reasons instead. Avatar, gender and reputation-as-a-number are
   not signals, and a test asserts that permuting them leaves scores bit-identical.

## Commands

```bash
npm run dev              # Vite dev server
npm run build:data       # rebuild the worldwide airport dataset (+ verify)
npm run test:pure        # the engines, plain Node, sub-second
npm run test:ui          # the redaction boundary, jsdom
npm run e2e              # Playwright flows
npm run verify           # typecheck + pure typecheck + boundaries + all tests
```

## Skill routing

| Task | Skill |
|---|---|
| Any visual work — new screen, component, palette, layout | `ui-ux-pro-max` |
| Animation, transition, press state, interaction polish | `emil-design-eng` |
| Charts or data display | `dataviz` |
| Reviewing a design or mockup | `design:design-critique` |
| WCAG / contrast / keyboard / touch-target audit | `design:accessibility-review` |
| Microcopy, error messages, empty states, CTA wording | `design:ux-copy` |
| Extending or auditing the token set | `design:design-system` |
| Before any feature work | `superpowers:brainstorming` → `superpowers:writing-plans` |
| Any bug or test failure | `superpowers:systematic-debugging` |
| Writing tests | `superpowers:test-driven-development` |
| Before claiming anything works | `superpowers:verification-before-completion` |

**`ui-ux-pro-max` and `emil-design-eng` are not in this project.** They live in the
parent workspace at `C:\Users\ShunGong\Downloads\claude code\.claude\skills\`, which is
outside this project's skill registry, so the `Skill` tool will not list them. Read them
from that path directly.

`ui-ux-pro-max` is more than a document — it ships a queryable CSV database:

```bash
python "C:/Users/ShunGong/Downloads/claude code/.claude/skills/ui-ux-pro-max/scripts/search.py" "<query>" --domain ux
```

Domains: `product · style · typography · color · landing · chart · ux · react · web`.

## Design system

Light-first, warm, photo-led, generous. Four hues total: ink, ember accent, trust green,
guardian indigo. Colour is never the only indicator — every stamp and state carries an
icon and a label as well.

- **Type:** Fraunces (display) · Inter (UI) · JetBrains Mono (flights, times, money).
- **Motion:** custom easing curves only, never `ease-in` on UI, nothing over 300ms
  except the one signature moment, `scale(0.97)` on every press, never enter from
  `scale(0)`. `prefers-reduced-motion` removes movement and keeps opacity.
- **Frequently-seen surfaces do not animate.** The board and the inbox get hit dozens
  of times a day; the elaborate moment is reserved for accepting a request, which is
  rare by construction.

Tokens live in `design/tokens/` and nothing outside that folder may write a literal
colour.

## What is mocked, and what that means

Verification providers, flight schedules without an API key, and guardian location
pings are mocked — deliberately, and the mocks are structured so the real thing drops in
behind the same interface. Do not "fix" a mock into a live integration without asking:
`stamps/registry.ts` selects mock vs real on env, and that switch is the seam.

Flight data degrades rather than fails: live provider → fresh cache → stale cache
(flagged) → bundled schedule → synthetic → manual entry. With no API keys at all the app
works completely, worldwide, offline. Adding a key improves accuracy; it never unlocks
functionality.
