# Persona testing

Real screenshots, walked by AI personas that are told to react only to what is visible.

```
testing/
  flows/        Playwright flows, one per journey. Committed.
  personas/     Who walks the screenshots. Committed.
  prompts/      The runner prompt — the banned/required block is verbatim. Committed.
  screenshots/  <date>/<flow>/<nn>-<state>.png                Generated, ignored.
  reports/      <date>/<persona>.md · ROLLUP.md                Generated, ignored.
```

## Run

```bash
npm run personas:flows        # produces testing/screenshots/<today>/…
```

Then each persona is run as an agent: it gets `prompts/persona-runner.md`, its own
persona file, and the ordered screenshot paths for all six flows, and writes
`reports/<date>/<persona>.md`. The roll-up reads every report and ranks:

- **P0** — flagged by three or more personas, or *any* safety/privacy flag
- **P1** — blocking for one persona
- **P2** — friction only

Severity beats volume.

## Conventions for every flow

- `shot(page, 'state')` after each meaningful state change, named for the state.
- `key(locator, 'what')` on each screen's key element, so a wrong screen fails loudly.
- One deliberate deviation from the happy path per flow.
- The flow layer is driver-agnostic; only `_shot.ts` touches capture.
