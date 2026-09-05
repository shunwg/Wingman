import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { webcrypto } from 'node:crypto';

// Vitest does not auto-unmount between tests unless `globals` is on; without
// this, the second test in a file queries the first test's DOM as well.
afterEach(() => cleanup());

// jsdom has no layout; the router scrolls to the top on every route change.
window.scrollTo = () => {};

// jsdom has no SubtleCrypto; the join and setup screens hash addresses with it.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
