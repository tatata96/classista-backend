import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Tests that use a real database. Kept apart from `npm test` on purpose: they
// need TEST_DATABASE_URL and delete data. See test/integration/test-database.ts.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.integration-spec.ts'],
    globalSetup: ['./test/integration/global-setup.ts'],
    // One shared database: files must not run at the same time.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
