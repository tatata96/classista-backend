import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SupabaseAuthService } from './supabase-auth.service.js';
import { createRemoteJWKSet, jwtVerify } from 'jose';

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => 'FAKE_JWKS'),
  jwtVerify: vi.fn(),
}));

describe('SupabaseAuthService', () => {
  let service: SupabaseAuthService;

  beforeEach(async () => {
    vi.mocked(createRemoteJWKSet).mockClear();
    vi.mocked(jwtVerify).mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseAuthService,
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => 'https://project-ref.supabase.co' },
        },
      ],
    }).compile();

    service = module.get<SupabaseAuthService>(SupabaseAuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('builds the JWKS from the configured Supabase project URL', () => {
    expect(createRemoteJWKSet).toHaveBeenCalledWith(
      new URL('https://project-ref.supabase.co/auth/v1/.well-known/jwks.json'),
    );
  });

  it('returns the verified payload for a valid token (covers AC-4)', async () => {
    const payload = { sub: 'supabase-user-1', email: 'jane@example.com' };
    vi.mocked(jwtVerify).mockResolvedValue({ payload } as any);

    const result = await service.verifyAccessToken('a-valid-token');

    expect(result).toEqual(payload);
    expect(jwtVerify).toHaveBeenCalledWith('a-valid-token', 'FAKE_JWKS', {
      issuer: 'https://project-ref.supabase.co/auth/v1',
      audience: 'authenticated',
    });
  });

  it('rejects a token with an invalid signature (covers AC-2)', async () => {
    vi.mocked(jwtVerify).mockRejectedValue(new Error('signature verification failed'));

    await expect(service.verifyAccessToken('tampered-token')).rejects.toThrow();
  });

  it('rejects an expired token (covers AC-3)', async () => {
    vi.mocked(jwtVerify).mockRejectedValue(new Error('"exp" claim timestamp check failed'));

    await expect(service.verifyAccessToken('expired-token')).rejects.toThrow();
  });

  it('rejects a token issued for a different project (wrong issuer)', async () => {
    vi.mocked(jwtVerify).mockRejectedValue(new Error('unexpected "iss" claim value'));

    await expect(service.verifyAccessToken('wrong-issuer-token')).rejects.toThrow();
  });
});
