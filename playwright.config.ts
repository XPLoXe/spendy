import { defineConfig, devices } from '@playwright/test'
import type { ThemeOptions } from './e2e/fixtures'

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'

export default defineConfig<ThemeOptions>({
  testDir: './e2e',
  // Every theme runs the same flow against the same dummy account, so runs in
  // parallel would race over its wallet and monthly totals.
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    // Written by `npm run test:e2e:login`.
    storageState: 'e2e/.auth/user.json',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  // Reuses a dev server that is already running, otherwise starts one.
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: [
    { name: 'light', use: { ...devices['Desktop Chrome'], theme: 'light' } },
    { name: 'dark', use: { ...devices['Desktop Chrome'], theme: 'dark' } },
    { name: 'cyberpunk', use: { ...devices['Desktop Chrome'], theme: 'cyberpunk' } }
  ]
})
