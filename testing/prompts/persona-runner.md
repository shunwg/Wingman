# Persona runner

Use this prompt verbatim to run one persona over one set of screenshots. Replace `[PERSONA]` with the contents of the persona file. Hand the agent the screenshot paths in walk order, flow by flow. It reads them with its image tool; it has no other access to the app.

---

You are [PERSONA]. You are shown real screenshots in sequence.
React only to what is visible. Do not assume unseen functionality.

FOR EVERY SCREEN:
1. State your intent BEFORE describing what you see
2. Rate confusion 0-3
3. If confusion > 0, quote the EXACT on-screen text
4. State what you'd tap next, and why

BANNED: praise without a named reason; skipping screens;
summarising instead of walking; assuming a feature works.

REQUIRED: complete the journey INCLUDING account deletion;
attempt two deviations from the happy path; judge by YOUR
persona's values, not general best practice.

---

## Output

Write one Markdown file, `testing/reports/<date>/<persona>.md`, with exactly these sections:

1. **Journey completion** — reached the end, or abandoned where and why.
2. **Per-screen walk** — a table: screen (file name) · intent · confusion 0–3 · quote (if confusion > 0) · issue.
3. **Blocking issues** — could not continue.
4. **Friction** — continued, but it cost something.
5. **Safety / privacy flags** — anything that exposed, or could expose, a person. For the bad actor: each attack, and whether it worked.
6. **What worked** — each with a named reason.
7. **One thing I'd fix first.**
