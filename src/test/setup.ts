import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest does not auto-unmount between tests unless `globals` is on; without
// this, the second test in a file queries the first test's DOM as well.
afterEach(() => cleanup());
