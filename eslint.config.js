import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Boundary enforcement.
 *
 * The four swappable axes (design, screens, matching, stamps) plus the privacy
 * engine only stay swappable if the edges between them are enforced rather than
 * merely documented. tsconfig.pure.json catches browser APIs; these rules catch
 * everything else — cross-axis imports, impure clocks, and the two leaks that
 * would quietly undo the privacy model.
 */

const IMPURE_GLOBALS = [
  {
    selector: "CallExpression > MemberExpression[object.name='Date'][property.name='now']",
    message:
      'Pure engines must not read the clock. Take `now: ISODateTime` as a parameter so tests can control time.',
  },
  {
    selector: "CallExpression > MemberExpression[object.name='Math'][property.name='random']",
    message:
      'Pure engines must be deterministic. Use lib/rng.ts seeded from stable inputs so ordering is reproducible.',
  },
];

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'src/data/airports/*.json',
      'build',
      'wingman.html',
      // The Lovable build of the same brief, kept locally to read from. Not
      // ours, not in git, and not ours to lint.
      'References',
      // Build scripts for the deployment memo — Node, not browser, same
      // category as scripts/.
      'docs/**/*.mjs',
      // The v2 prototype: six concatenated classic scripts sharing one global
      // scope. Kept only until its seed fixtures are ported in phase 4a, then
      // deleted along with build/ and wingman.html. Linting it under the new
      // config produces 489 no-undef errors and zero useful signal.
      'src/*.js',
      'src/styles.css',
      'src/shell.html',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
    },
  },

  // ── design/ ────────────────────────────────────────────────────────────────
  // Renders things. Knows types and nothing else. Swapping the whole design
  // system must never require touching an engine.
  {
    files: ['src/design/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@screens/*', '@matching/*', '@privacy/*', '@stamps/*', '@state/*', '@providers/*'],
            message: 'design/ may only import from @domain and @lib. It renders; it does not decide.' },
        ],
        paths: [
          { name: '@domain/person', importNames: ['Person', 'Profile'],
            message: 'Components take RedactedPerson, never Person. Full identity must not be reachable from a component.' },
        ],
      }],
    },
  },

  // ── matching/ and privacy/ ────────────────────────────────────────────────
  // Pure. Node-runnable. No React, no DOM, no clock, no randomness.
  {
    files: ['src/matching/**/*.ts', 'src/privacy/**/*.ts', 'src/domain/**/*.ts', 'src/lib/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...IMPURE_GLOBALS],
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['react', 'react-dom', '@design/*', '@screens/*', '@state/*', '@providers/*', 'zustand', '@tanstack/*'],
            message: 'Pure engines must run under plain Node. Inject what you need as a parameter.' },
        ],
      }],
    },
  },

  // privacy/ must not reach into matching/ — the dependency runs one way only,
  // so a privacy rule can never be written in terms of a match result.
  {
    files: ['src/privacy/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@matching/*'], message: 'privacy/ is upstream of matching/. The dependency is one-directional.' },
          { group: ['react', 'react-dom', '@design/*', '@screens/*', '@state/*', '@providers/*'],
            message: 'Pure engine.' },
        ],
      }],
    },
  },

  // ── screens/ ──────────────────────────────────────────────────────────────
  // May use everything, but only through each engine's public index, and never
  // by naming a verification provider — that is what keeps stamps pluggable.
  {
    files: ['src/screens/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@matching/*/*', '@privacy/*/*', '@stamps/*/*', '@providers/flights/adapters/*'],
            message: 'Import engines through their public index (e.g. @privacy), not their internals.' },
        ],
        paths: [
          { name: '@domain/person', importNames: ['Person'],
            message: 'Screens take RedactedPerson. If you need a field the redaction ladder withholds, change the ladder, not the screen.' },
        ],
      }],
      // Provider *ids* only. `email_domain` used to be on this list and had to
      // come off: it is also a `StampKind`, so a screen filtering verifications
      // by kind — which is exactly the right abstraction — tripped a rule meant
      // to stop it naming providers. The provider is now `email_otp`, and the
      // kind and the id no longer collide.
      'no-restricted-syntax': ['error', {
        selector:
          "Literal[value=/^(bankid_no|linkedin|facebook|instagram|google|email_otp)$/]",
        message:
          'Screens must not name a verification provider. Render from availableProviders(env) and each provider\'s display descriptor, so adding a provider needs zero screen edits.',
      }],
    },
  },

  // Tests are exempt from the impurity rules — a test controlling a clock or
  // naming a provider id is exactly what a test is for.
  {
    files: ['**/__tests__/**', '**/*.test.ts', '**/*.uitest.tsx', 'e2e/**', 'scripts/**'],
    rules: {
      'no-restricted-syntax': 'off',
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
