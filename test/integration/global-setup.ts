import { execFileSync } from 'node:child_process';
import { getTestDatabaseUrl } from './test-database.js';

// Runs once before the integration tests: checks the URL is the local test
// database, then brings its schema up to date. `migrate deploy` only applies
// migrations that are missing, so repeat runs are fast and keep no old data.
export default function setup(): void {
  const url = getTestDatabaseUrl(); // throws unless it is the safe database

  execFileSync(
    'npx',
    ['prisma', 'migrate', 'deploy', '--config', 'prisma7.config.ts'],
    {
      stdio: 'inherit',
      // prisma7.config.ts reads DATABASE_URL, so give it the test URL. dotenv
      // does not override a variable that is already set.
      env: { ...process.env, DATABASE_URL: url },
    },
  );
}
