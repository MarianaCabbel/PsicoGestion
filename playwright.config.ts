import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de extremo a extremo de PsicoGestión.
 *
 * El servidor de desarrollo se levanta automáticamente (backend en 4000 y
 * frontend en 3000). Las pruebas autenticadas se omiten si no se definen
 * E2E_EMAIL y E2E_PASSWORD; las públicas y las de rendimiento siempre corren.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    locale: 'es-MX',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/login',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      NOTIFICACIONES_WORKER: 'false',
    },
  },
});
