import {
  assertSafeTestDatabaseUrl,
  getTestDatabaseUrl,
} from './test-database.js';

const SAFE = 'postgresql://test:test@127.0.0.1:54329/classista_test';

describe('assertSafeTestDatabaseUrl', () => {
  it.each([
    SAFE,
    'postgresql://test:test@localhost:54329/classista_test',
    'postgres://u:p@127.0.0.1:54329/classista_test',
  ])('accepts %s', (url) => {
    expect(assertSafeTestDatabaseUrl(url)).toBe(url);
  });

  it('refuses when the variable is missing or empty', () => {
    expect(() => assertSafeTestDatabaseUrl(undefined)).toThrow('not set');
    expect(() => assertSafeTestDatabaseUrl('')).toThrow('not set');
  });

  it('refuses text that is not a URL', () => {
    expect(() => assertSafeTestDatabaseUrl('nonsense')).toThrow('valid URL');
  });

  it.each([
    [
      'a remote host (like Supabase)',
      'postgresql://u:p@aws-1-ap-northeast-2.pooler.supabase.com:54329/classista_test',
      'host',
    ],
    [
      'another local host name',
      'postgresql://u:p@0.0.0.0:54329/classista_test',
      'host',
    ],
    [
      'the default Postgres port',
      'postgresql://u:p@127.0.0.1:5432/classista_test',
      'port',
    ],
    ['no port', 'postgresql://u:p@127.0.0.1/classista_test', 'port'],
    [
      'another database name',
      'postgresql://u:p@127.0.0.1:54329/postgres',
      'database',
    ],
    ['no database name', 'postgresql://u:p@127.0.0.1:54329', 'database'],
    [
      'a different protocol',
      'mysql://u:p@127.0.0.1:54329/classista_test',
      'protocol',
    ],
    [
      'a query string that could override the host',
      `${SAFE}?host=aws-1-ap-northeast-2.pooler.supabase.com`,
      'query',
    ],
    [
      'a remote host hidden after an @ in the password',
      'postgresql://u:127.0.0.1:54329@evil.example.com:54329/classista_test',
      'host',
    ],
  ])('refuses %s', (_label, url, problem) => {
    expect(() => assertSafeTestDatabaseUrl(url)).toThrow(problem);
  });

  it('never prints the credentials', () => {
    expect(() =>
      assertSafeTestDatabaseUrl('postgresql://me:s3cret@evil.com:1/x'),
    ).toThrow(/^(?!.*s3cret)/s);
  });
});

describe('getTestDatabaseUrl', () => {
  const original = {
    test: process.env['TEST_DATABASE_URL'],
    dev: process.env['DATABASE_URL'],
  };

  afterEach(() => {
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    };
    restore('TEST_DATABASE_URL', original.test);
    restore('DATABASE_URL', original.dev);
  });

  it('reads TEST_DATABASE_URL', () => {
    process.env['TEST_DATABASE_URL'] = SAFE;

    expect(getTestDatabaseUrl()).toBe(SAFE);
  });

  it('does not fall back to DATABASE_URL, even when it looks safe', () => {
    delete process.env['TEST_DATABASE_URL'];
    process.env['DATABASE_URL'] = SAFE;

    expect(() => getTestDatabaseUrl()).toThrow('not set');
  });
});
