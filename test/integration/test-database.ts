import type { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../src/lib/database/prisma.service.js';

// The integration tests delete data, so they may only ever touch the local
// throwaway database from docker (see docs or the Step 8 notes):
//   docker run -d --name classista-test-db -e POSTGRES_USER=test \
//     -e POSTGRES_PASSWORD=test -e POSTGRES_DB=classista_test \
//     -p 127.0.0.1:54329:5432 postgres:17.4
//   TEST_DATABASE_URL=postgresql://test:test@127.0.0.1:54329/classista_test
//
// Everything here reads TEST_DATABASE_URL and nothing else. DATABASE_URL (the
// development database) is never read, so a missing variable fails loudly
// instead of falling back to it.

const ALLOWED_HOSTS = ['localhost', '127.0.0.1'];
const ALLOWED_PORT = '54329';
const ALLOWED_DATABASE = 'classista_test';

/** Returns the URL if it is the local test database, otherwise throws. */
export function assertSafeTestDatabaseUrl(rawUrl: string | undefined): string {
  if (!rawUrl) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Integration tests never fall back to DATABASE_URL.',
    );
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('TEST_DATABASE_URL is not a valid URL.');
  }

  const database = url.pathname.replace(/^\//, '');
  const problems: string[] = [];

  if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
    problems.push(`protocol ${url.protocol}`);
  }
  if (!ALLOWED_HOSTS.includes(url.hostname)) {
    problems.push(`host ${url.hostname}`);
  }
  if (url.port !== ALLOWED_PORT) {
    problems.push(`port ${url.port || '(default)'}`);
  }
  if (database !== ALLOWED_DATABASE) {
    problems.push(`database ${database || '(none)'}`);
  }
  // pg lets a query string such as ?host=... override the host above.
  if (url.search !== '') {
    problems.push('query parameters');
  }

  if (problems.length > 0) {
    // Credentials are left out of the message on purpose.
    throw new Error(
      `Refusing to run: TEST_DATABASE_URL must be localhost:${ALLOWED_PORT}/${ALLOWED_DATABASE} ` +
        `(found: ${problems.join(', ')}).`,
    );
  }

  return rawUrl;
}

/** The validated test database URL, read from TEST_DATABASE_URL only. */
export function getTestDatabaseUrl(): string {
  return assertSafeTestDatabaseUrl(process.env['TEST_DATABASE_URL']);
}

/** A connected PrismaService for the test database. */
export async function createTestPrisma(): Promise<PrismaService> {
  const url = getTestDatabaseUrl();
  // PrismaService only asks its ConfigService for DATABASE_URL.
  const config = { getOrThrow: () => url } as unknown as ConfigService;
  const prisma = new PrismaService(config);
  await prisma.$connect();
  await assertConnectedToTestDatabase(prisma);
  return prisma;
}

// A second, independent check on the live connection: whatever the URL said,
// the server must report the test database.
async function assertConnectedToTestDatabase(
  prisma: PrismaService,
): Promise<void> {
  const [{ current_database }] = await prisma.$queryRaw<
    { current_database: string }[]
  >`select current_database()`;

  if (current_database !== ALLOWED_DATABASE) {
    await prisma.$disconnect();
    throw new Error(
      `Refusing to run: connected to database "${current_database}", expected "${ALLOWED_DATABASE}".`,
    );
  }
}

/** Empties every table (keeps the schema). Checks the connection first. */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await assertConnectedToTestDatabase(prisma);

  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> '_prisma_migrations'`;

  if (tables.length === 0) {
    return;
  }

  const names = tables.map(({ tablename }) => `"${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${names} RESTART IDENTITY CASCADE`);
}
