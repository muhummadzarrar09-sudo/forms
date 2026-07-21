import { defineConfig } from '@playwright/test';

// Deliberately disposable test-only values. These must never be replaced with
// production Supabase credentials.
const testEnv = {
  DATABASE_URL: 'postgresql://forms_test:forms_test@127.0.0.1:54329/forms_test?schema=public',
  DIRECT_URL: 'postgresql://forms_test:forms_test@127.0.0.1:54329/forms_test?schema=public',
  NEXTAUTH_URL: 'http://127.0.0.1:3001',
  NEXTAUTH_SECRET: 'forms-e2e-test-secret-not-for-production',
  NODE_ENV: 'test',
};

Object.assign(process.env, testEnv);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: 'http://127.0.0.1:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'bun run dev:e2e',
    url: 'http://127.0.0.1:3001',
    reuseExistingServer: !process.env.CI,
    env: testEnv,
    timeout: 60_000,
  },
});
