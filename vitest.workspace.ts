import { defineWorkspace } from 'vitest/config';

/**
 * Two projects, one alias source. Both extend vite.config.ts so the path
 * aliases live in exactly one place — the same file Vite and the boundary
 * checker already agree on.
 *
 *   pure — plain Node, no jsdom, no React. The engines. Sub-second.
 *   ui   — jsdom, narrow: the redaction boundary and a11y-critical rendering.
 */
export default defineWorkspace([
  {
    // The engines. If a test here needs a DOM to pass, it is in the wrong
    // project — and that is usually a signal the code under test has drifted
    // out of the pure layer.
    extends: './vite.config.ts',
    test: {
      name: 'pure',
      environment: 'node',
      include: [
        'src/domain/**/*.test.ts',
        'src/matching/**/*.test.ts',
        'src/privacy/**/*.test.ts',
        'src/stamps/**/*.test.ts',
        'src/providers/**/*.test.ts',
        'src/state/**/*.test.ts',
        'src/data/**/*.test.ts',
        'src/lib/**/*.test.ts',
        'src/design/avatar/**/*.test.ts',
      ],
    },
  },
  {
    // Everything else is covered by the pure project or by Playwright.
    extends: './vite.config.ts',
    test: {
      name: 'ui',
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/design/**/*.uitest.tsx', 'src/screens/**/*.uitest.tsx'],
    },
  },
]);
