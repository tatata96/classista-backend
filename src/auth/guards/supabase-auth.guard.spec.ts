import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard.js';
import { SupabaseAuthService } from '../supabase-auth.service.js';
import { AuthService } from '../auth.service.js';

function contextWithRequest(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('SupabaseAuthGuard', () => {
  const supabaseAuthMock = { verifyAccessToken: vi.fn() };
  const authServiceMock = { findOrCreateUser: vi.fn() };

  let guard: SupabaseAuthGuard;

  beforeEach(async () => {
    supabaseAuthMock.verifyAccessToken.mockReset();
    authServiceMock.findOrCreateUser.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseAuthGuard,
        { provide: SupabaseAuthService, useValue: supabaseAuthMock },
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compile();

    guard = module.get<SupabaseAuthGuard>(SupabaseAuthGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('rejects a request with no Authorization header (covers AC-1)', async () => {
    const request = { headers: {} };
    const result = guard.canActivate(contextWithRequest(request));

    await expect(result).rejects.toThrow(UnauthorizedException);
    await expect(result).rejects.toThrow('Missing bearer token');
    expect(supabaseAuthMock.verifyAccessToken).not.toHaveBeenCalled();
    expect(authServiceMock.findOrCreateUser).not.toHaveBeenCalled();
  });

  it('rejects a header that is not a bearer token (covers AC-1)', async () => {
    const request = { headers: { authorization: 'Basic somevalue' } };

    await expect(guard.canActivate(contextWithRequest(request))).rejects.toThrow(
      'Missing bearer token',
    );
  });

  it('rejects when verification fails, without ever resolving a user (covers AC-2, AC-3)', async () => {
    const request = { headers: { authorization: 'Bearer bad-token' } };
    supabaseAuthMock.verifyAccessToken.mockRejectedValue(new Error('invalid signature'));

    const result = guard.canActivate(contextWithRequest(request));

    await expect(result).rejects.toThrow(UnauthorizedException);
    await expect(result).rejects.toThrow('Invalid or expired token');
    expect(authServiceMock.findOrCreateUser).not.toHaveBeenCalled();
  });

  it('does not leak the raw token in the thrown error (covers AC-7)', async () => {
    const request = { headers: { authorization: 'Bearer super-secret-token-value' } };
    supabaseAuthMock.verifyAccessToken.mockRejectedValue(new Error('invalid signature'));

    await expect(guard.canActivate(contextWithRequest(request))).rejects.not.toThrow(
      'super-secret-token-value',
    );
  });

  it('resolves the Classista user and attaches it to the request on a valid token (covers AC-4, AC-6)', async () => {
    const payload = { sub: 'supabase-1', email: 'jane@example.com' };
    const resolvedUser = { id: 'u1', name: 'Jane', email: 'jane@example.com', role: 'CUSTOMER' };
    const request = { headers: { authorization: 'Bearer good-token' } };

    supabaseAuthMock.verifyAccessToken.mockResolvedValue(payload);
    authServiceMock.findOrCreateUser.mockResolvedValue(resolvedUser);

    const canProceed = await guard.canActivate(contextWithRequest(request));

    expect(canProceed).toBe(true);
    expect(authServiceMock.findOrCreateUser).toHaveBeenCalledWith(payload);
    expect((request as any).user).toEqual(resolvedUser);
  });

  it('lets an email collision conflict propagate as its real 409, not a 401', async () => {
    const request = { headers: { authorization: 'Bearer good-token' } };
    supabaseAuthMock.verifyAccessToken.mockResolvedValue({ sub: 'supabase-1' });
    authServiceMock.findOrCreateUser.mockRejectedValue(
      new ConflictException('An account with this email already exists.'),
    );

    await expect(guard.canActivate(contextWithRequest(request))).rejects.toThrow(
      ConflictException,
    );
  });
});
