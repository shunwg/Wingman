import { defineConfig, devices } from '@playwright/test';

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
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
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
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
