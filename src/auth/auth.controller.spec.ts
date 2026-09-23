import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthController } from './auth.controller.js';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard.js';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it("returns the authenticated user the guard attached to the request (covers AC-4)", () => {
    const user = { id: 'u1', name: 'Jane', email: 'jane@example.com', role: 'CUSTOMER' as const };
    const request = { user } as unknown as Request;

    expect(controller.me(request)).toEqual(user);
  });

  it('throws unauthorized if it is somehow called with no user on the request', () => {
    const request = {} as unknown as Request;

    expect(() => controller.me(request)).toThrow(UnauthorizedException);
  });
});
