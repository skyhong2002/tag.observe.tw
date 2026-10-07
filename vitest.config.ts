import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['app/test/**/*.spec.ts', 'app/src/**/*.spec.ts', 'web/test/**/*.spec.ts'],
    environment: 'node',
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: { junit: 'artifacts/vitest-junit.xml' },
    coverage: { provider: 'v8', include: ['app/src/**'], reportsDirectory: 'artifacts/coverage' },
  },
});
