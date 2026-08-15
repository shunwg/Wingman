import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

const alias = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Shared resolution. The two test projects live in vitest.workspace.ts:
 *
 *   pure — plain Node, no jsdom, no React. The engines. Sub-second.
 *   ui   — jsdom, narrow, only the redaction boundary.
 */
export default defineConfig({
  resolve: {
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
  },
});
