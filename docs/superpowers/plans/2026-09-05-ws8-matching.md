# WS8 — Matching v2

> Scoped in `2026-09-05-wingman-v4.md` § WS8. Cites: V5. Carried from the v3 plan, unchanged in intent; agreed via AskUserQuestion (stable matching + reciprocity, no PUA lineage).

## Tasks

1. **Reciprocity from conduct** — `rank/reciprocity.ts`: `estimateAcceptance({ responseRate, reputation })`. Two inputs, both conduct. A test asserts extra fields (gender, photo, popularity) change nothing.
2. **Deferred acceptance** — `rank/stable.ts`: general Gale–Shapley over preference lists, plus `blockingPairs` for the tests. Property tests: terminates, no blocking pair, each side matched at most once, order-independent.
3. **Three signals** — `scarcity` (the window is the thing that expires), `complementarity` (adjacent, not identical), `cohort` (how much of your world they share, under the circle cap). Weights renormalised to 1.0.
4. **The stable pick** — the engine scores each pair from both sides (roles swapped, conduct neutral for the viewer), takes the harmonic mean as the mutual score, runs deferred acceptance, and flags the pick `mostCompatible`. The card renders a label; the number is never rendered (rule 7).
5. **Invariance** — the existing test (avatar, photo, gender, name permuted → bit-identical score and signals) must still pass, and now covers the new signals and the flag.

## Exit

`npm run verify` green with the new tests; the board shows one "Most compatible" chip per open trip; no screen or design file references `score`.
