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
  timeout: 90_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chromium', use: { ...devices['iPhone 13'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: 'pnpm dev', url: baseURL, reuseExistingServer: !process.env.CI, timeout: 180_000,
  },
})
