import { defineConfig, devices } from '@playwright/test';

/**
 * iPhone 17 Pro, portrait. Playwright's descriptors stop at older models; the
 * viewport is what matters for layout, and it is the one the CSS frame and the
 * screenshot script target too.
 */
const iphone17pro = {
  ...devices['iPhone 13'],
  viewport: { width: 402, height: 874 },
  deviceScaleFactor: 3,
  browserName: 'chromium' as const,
};

/**
 * End-to-end flows against the dev server.
 *
 * Mobile first, because that is where the app is used; the desktop project
 * exists for the one flow that differs by platform (BankID shows a reference
 * on desktop and a deep link on a phone).
 */
export default defineConfig({
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  // Both projects run on Chromium: it is the only browser installed locally and
  // in CI, and the iPhone descriptor otherwise asks for WebKit.
  projects: [
    {
      name: 'mobile',
      testDir: 'e2e',
      use: iphone17pro,
      testIgnore: /.*desktop\.spec\.ts/,
    },
    {
      name: 'desktop',
      testDir: 'e2e',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium' },
      testMatch: /.*desktop\.spec\.ts/,
    },
    // The persona flows: screenshots for an AI persona to walk, not assertions
    // for CI. Run on purpose with `npm run personas:flows`, never by `e2e`.
    {
      name: 'personas',
      testDir: 'testing/flows',
      testMatch: /.*\.flow\.ts/,
      use: iphone17pro,
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
