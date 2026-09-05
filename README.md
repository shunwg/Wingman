# Wingman

Meet people worth meeting, around the way you already travel.

Someone on your flight, in your terminal during a layover, or landing in the same
city tonight — for a coffee at the gate, a shared ride into town, dinner, or a business
introduction. Honestly social *and* professional; never a dating app pretending otherwise.

**Live:** https://shunwg.github.io/Wingman/ · **Demo as Alex:** https://shunwg.github.io/Wingman/#/demo

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

| Command | What it proves |
|---|---|
| `npm run verify` | typecheck · pure typecheck (no DOM in the engines) · import boundaries · dataset · all tests |
| `npm run lint` | the cross-folder rules, the `Date.now()`/`Math.random()` bans, the provider-id ban in screens |
| `npm run e2e` | Playwright flows against the dev server (starts it for you) |
| `npm run build` | the production bundle in `dist/` |
| `npm run shoot` | screenshots of every route → `docs/shots/` (needs `npm run dev` running); `SHOOT_DARK=1` shoots both themes |
| `npm run build:data` | regenerate the worldwide airport dataset from OurAirports (network) |

## Where things live

| Folder | What |
|---|---|
| `src/domain/` | the contract — types every other folder depends on; depends on nothing |
| `src/privacy/` · `src/matching/` · `src/stamps/` | pure engines: who may see whom, who appears in what order, how identity is proved |
| `src/design/` | tokens, primitives, patterns, the brand mark, the procedural portrait generator |
| `src/screens/` | one folder per surface, logic in that folder's `use*.ts` hook |
| `src/state/` | the Zustand store, the request state machine, derived selectors |
| `src/data/` | the airport index, seed cast, copy tables |
| `scripts/` | data build, boundary checker, screenshots, brand icons, memo print |
| `e2e/` | Playwright specs |
| `docs/` | `STATUS.md` (where the build is), `reviews/` (feedback and iteration log), `deploy-memo/`, `superpowers/plans/` |

Reviewed 6 September 2026 against two scorecards (`docs/reviews/2026-09-05-feedback.md`): Jobs 9.55 / 10, Thiel 9.5 / 10.

Rules that are load-bearing, the import boundaries, and the design system are in
[`CLAUDE.md`](CLAUDE.md). Progress and known gaps are in [`docs/STATUS.md`](docs/STATUS.md).
