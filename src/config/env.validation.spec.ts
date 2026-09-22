import 'reflect-metadata';
import { validateEnv } from './env.validation.js';

const validConfig = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/classista',
  CORS_ORIGIN: 'http://localhost:5173',
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
});
