import { defineConfig } from 'vitest/config';

// Specs that truncate and count tables in the shared TEST_DB_URL database
// must not run at the same time; everything else stays parallel.
const sharedDb = [
  'app/test/integration.spec.ts',
  'app/test/admin-media.spec.ts',
  'app/test/taiwan-share.spec.ts',
  'app/test/reader.spec.ts',
];

export default defineConfig({
  test: {
    environment: 'node',
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: { junit: 'artifacts/vitest-junit.xml' },
    coverage: { provider: 'v8', include: ['app/src/**'], reportsDirectory: 'artifacts/coverage' },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['app/test/**/*.spec.ts', 'app/src/**/*.spec.ts', 'web/test/**/*.spec.ts'],
          exclude: sharedDb,
        },
      },
      { extends: true, test: { name: 'shared-db', include: sharedDb, fileParallelism: false } },
    ],
  },
});
