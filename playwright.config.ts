import { defineConfig, devices } from '@playwright/test'
import { loadEnvConfig } from '@next/env'

const originalNodeEnv = process.env.NODE_ENV
Reflect.set(process.env, 'NODE_ENV', 'development')
loadEnvConfig(process.cwd(), true)
Reflect.set(process.env, 'NODE_ENV', originalNodeEnv || 'test')
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0, // a WebKit crash on the runner gets one more try; a real failure still fails twice
  timeout: 90_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } },
  ],
  // CI tests the production build from its own `pnpm build` step: under load the dev server serves
  // half-compiled pages ("Expected clientReferenceManifest to be defined") and sign-in never starts.
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: process.env.CI ? 'pnpm start' : 'pnpm dev', url: baseURL, reuseExistingServer: !process.env.CI, timeout: 180_000,
  },
})
