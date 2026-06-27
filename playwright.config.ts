import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4319',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'bun scripts/static-server.mjs',
    url: 'http://localhost:4319',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
