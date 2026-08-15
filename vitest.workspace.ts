import { defineWorkspace } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const alias = (p: string) => fileURLToPath(new URL(p, import.meta.url));

const resolve = {
  alias: {
    '@domain': alias('./src/domain'),
    '@design': alias('./src/design'),
    '@screens': alias('./src/screens'),
    '@matching': alias('./src/matching'),
    '@privacy': alias('./src/privacy'),
    '@stamps': alias('./src/stamps'),
    '@providers': alias('./src/providers'),
    '@state': alias('./src/state'),
    '@data': alias('./src/data'),
    '@lib': alias('./src/lib'),
  },
};

export default defineWorkspace([
  {
    // The engines. If a test here needs a DOM to pass, it is in the wrong
    // project — and that is usually a signal the code under test has drifted
    // out of the pure layer.
    resolve,
    test: {
      name: 'pure',
      environment: 'node',
      include: [
        'src/domain/**/*.test.ts',
        'src/matching/**/*.test.ts',
        'src/privacy/**/*.test.ts',
        'src/stamps/**/*.test.ts',
        'src/providers/**/*.test.ts',
        'src/state/machines/**/*.test.ts',
        'src/data/**/*.test.ts',
        'src/lib/**/*.test.ts',
        'src/design/avatar/**/*.test.ts',
      ],
    },
  },
  {
    // Deliberately narrow: the redaction boundary and a11y-critical rendering.
    // Everything else is covered by the pure project or by Playwright.
    resolve,
    plugins: [react()],
    test: {
      name: 'ui',
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/design/**/*.uitest.tsx', 'src/screens/**/*.uitest.tsx'],
    },
  },
]);
