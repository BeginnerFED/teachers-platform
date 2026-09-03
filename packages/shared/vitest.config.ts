import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],

    // The marking rules and the student projection are the two things in this package
    // that can be wrong rather than merely absent, so they are the two things measured.
    coverage: {
      provider: 'v8',
      include: ['src/grading.ts', 'src/contracts/blocks.ts'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
})
