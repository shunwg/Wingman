import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const alias = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
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
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          // The medium-airport table is only pulled in when a combobox query
          // misses the large-airport set. Keep it out of the entry bundle.
          'airports-medium': ['./src/data/airports/airports.medium.json'],
        },
      },
    },
  },
  server: { port: 5173 },
});
