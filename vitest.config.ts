import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

// Specs that truncate and count tables in the shared TEST_DB_URL database
// must not run at the same time; everything else stays parallel.
const sharedDb = [
  'app/test/integration.spec.ts',
  'app/test/admin-media.spec.ts',
  'app/test/taiwan-share.spec.ts',
  'app/test/reader.spec.ts',
  'app/test/tag-avatars.spec.ts',
  'app/test/picture-kind.spec.ts',
  'app/test/picture-submissions.spec.ts',
  'app/test/tag-semantic.spec.ts',
  'app/test/writing.spec.ts',
];

export default defineConfig({
  test: {
    environment: 'node',
    // Never read the live generated crawl rules (crawl/rules/store.ts) in tests.
    env: { TAG_GENERATED_RULES_DIR: join(tmpdir(), `tag-generated-rules-test-${process.pid}`) },
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
