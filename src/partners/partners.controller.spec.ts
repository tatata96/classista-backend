import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard.js';
import type { OnboardPartnerDto } from './dto/onboard-partner.dto.js';
import { PartnerAccessGuard } from './guards/partner-access.guard.js';
import { PartnersController } from './partners.controller.js';
import { PartnersService } from './partners.service.js';
import type { PartnerContext } from './types/partner-context.js';

const PARTNER: PartnerContext = {
  partnerId: '11111111-1111-4111-8111-111111111111',
  membershipRole: 'OWNER',
};

const ONBOARD_DTO: OnboardPartnerDto = {
  partner: { name: 'Kadıköy Yoga Studio' },
  venue: {
    addressLine: 'Bahariye Caddesi 12',
    district: 'Kadıköy',
    city: 'Istanbul',
  },
} as OnboardPartnerDto;

describe('PartnersController', () => {
  const partnersServiceMock = {
    findOne: vi.fn(),
    onboard: vi.fn(),
  };

  let controller: PartnersController;

  beforeEach(async () => {
    partnersServiceMock.findOne.mockReset();
    partnersServiceMock.onboard.mockReset();

    // findOne is guarded by real SupabaseAuthGuard/PartnerAccessGuard classes,
    // so compiling would otherwise try to resolve their real dependencies.
    // We call controller methods directly in these tests, bypassing guards
    // entirely, so a no-op override is enough.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PartnersController],
      providers: [{ provide: PartnersService, useValue: partnersServiceMock }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PartnerAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PartnersController>(PartnersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /partners/:partnerId', () => {
    it('delegates to the service with the verified partner id', async () => {
      const profile = { id: PARTNER.partnerId, name: 'Studio' };
      partnersServiceMock.findOne.mockResolvedValue(profile);

      const result = await controller.findOne(PARTNER);

      expect(partnersServiceMock.findOne).toHaveBeenCalledWith(PARTNER.partnerId);
      expect(result).toBe(profile);
    });
  });

  describe('POST /partners/onboarding', () => {
    // This is the requirement that matters most for this route: a brand-new
    // user has no PartnerMembership yet, so PartnerAccessGuard must never run
    // here (it would always reject them). Guards are applied per-method on
    // this controller, not at the class level, so metadata is read off the
    // method itself.
    it('is protected by SupabaseAuthGuard only, never PartnerAccessGuard', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        PartnersController.prototype.onboard,
      );

      expect(guards).toEqual([SupabaseAuthGuard]);
    });

    it("onboards using the authenticated request's user id", async () => {
      const response = { partner: { id: 'p1' }, venue: { id: 'v1' } };
      partnersServiceMock.onboard.mockResolvedValue(response);
      const request = { user: { id: 'user-alice', name: 'Alice', email: null, role: 'CUSTOMER' } };

      const result = await controller.onboard(request as unknown as Request, ONBOARD_DTO);

      expect(partnersServiceMock.onboard).toHaveBeenCalledWith('user-alice', ONBOARD_DTO);
      expect(result).toBe(response);
    });

    it('throws unauthorized if it is somehow called with no user on the request', async () => {
      await expect(
        controller.onboard({} as unknown as Request, ONBOARD_DTO),
      ).rejects.toThrow(UnauthorizedException);
      expect(partnersServiceMock.onboard).not.toHaveBeenCalled();
    });
  });
});
