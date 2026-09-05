import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const alias = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  // GitHub Pages serves a project site from /<repo-name>/, not from the
  // domain root — so every asset URL needs that prefix or the deployed page
  // loads an empty white screen while every script and stylesheet 404s. Local
  // dev and `vite preview` stay at root; only the GitHub Actions build sets
  // this env var. Hash routing (see routes.tsx) is what makes the rest of the
  // app agnostic to which path segment it's served under.
  base: process.env.GITHUB_PAGES ? '/Wingman/' : '/',
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
      '@assets': alias('./src/assets'),
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
          // The city table is needed on first paint but changes never; its own
          // chunk keeps it cached across every app release.
          cities: ['./src/data/airports/cities.json'],
          vendor: ['react', 'react-dom', 'zustand'],
        },
      },
    },
  },
  server: { port: 5173 },
});
