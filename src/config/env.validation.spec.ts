import 'reflect-metadata';
import { validateEnv } from './env.validation.js';

const validConfig = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/classista',
  CORS_ORIGIN: 'http://localhost:5173',
  SUPABASE_URL: 'https://project-ref.supabase.co',
};

describe('validateEnv', () => {
  it('accepts a valid port string', () => {
    expect(() => validateEnv({ ...validConfig, PORT: '4000' })).not.toThrow();
  });

  it('rejects a non-numeric port', () => {
    expect(() => validateEnv({ ...validConfig, PORT: 'hello' })).toThrow(
      'Invalid environment configuration',
    );
  });

  it('rejects a port outside the valid range', () => {
    expect(() => validateEnv({ ...validConfig, PORT: '65536' })).toThrow(
      'Invalid environment configuration',
    );
  });

  it('rejects a missing SUPABASE_URL', () => {
    const { SUPABASE_URL: _SUPABASE_URL, ...withoutSupabaseUrl } = validConfig;
    expect(() => validateEnv({ ...withoutSupabaseUrl, PORT: '4000' })).toThrow(
      'Invalid environment configuration',
    );
  });
});
