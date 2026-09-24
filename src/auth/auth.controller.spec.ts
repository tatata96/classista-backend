import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard.js';

describe('AuthController', () => {
  const authServiceMock = { getPartner: vi.fn() };

  let controller: AuthController;

  beforeEach(async () => {
    authServiceMock.getPartner.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authServiceMock }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns the authenticated user the guard attached to the request, with partner null (covers AC-4)', async () => {
    const user = { id: 'u1', name: 'Jane', email: 'jane@example.com', role: 'CUSTOMER' as const };
    authServiceMock.getPartner.mockResolvedValue(null);

    const result = await controller.me({ user } as unknown as Request);

    expect(result).toEqual({ ...user, partner: null });
    expect(authServiceMock.getPartner).toHaveBeenCalledWith('u1');
  });

  it("includes the user's partner, looked up by the verified user id", async () => {
    const user = { id: 'u1', name: 'Jane', email: null, role: 'CUSTOMER' as const };
    const partner = {
      id: 'p1',
      name: 'Core Studio',
      status: 'ACTIVE' as const,
      role: 'OWNER' as const,
    };
    authServiceMock.getPartner.mockResolvedValue(partner);

    const result = await controller.me({ user } as unknown as Request);

    expect(result).toEqual({ ...user, partner });
    expect(authServiceMock.getPartner).toHaveBeenCalledWith('u1');
  });

  it('throws unauthorized if it is somehow called with no user on the request', async () => {
    await expect(controller.me({} as unknown as Request)).rejects.toThrow(UnauthorizedException);
    expect(authServiceMock.getPartner).not.toHaveBeenCalled();
  });
});
