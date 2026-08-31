import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],

    // Modules pull `env` in at import time. Supplying fixtures here keeps a test run from
    // depending on whatever happens to be in the developer's shell.
    env: {
      NODE_ENV: 'test',
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SECRET_KEY: 'test-secret-key',
      LOG_LEVEL: 'silent',
    },

    coverage: {
      provider: 'v8',
      include: ['src/**/*.service.ts', 'src/**/*-policy.ts'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
})
