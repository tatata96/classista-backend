import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard.js';
import { BusinessProfileController } from './business-profile.controller.js';
import { PartnerAccessGuard } from './guards/partner-access.guard.js';
import { PartnersService } from './partners.service.js';
import type { PartnerContext } from './types/partner-context.js';

const PARTNER: PartnerContext = {
  partnerId: '11111111-1111-4111-8111-111111111111',
  membershipRole: 'OWNER',
};

describe('BusinessProfileController', () => {
  const partnersServiceMock = {
    findBusinessProfile: vi.fn(),
    updateBusinessProfile: vi.fn(),
  };

  let controller: BusinessProfileController;

  beforeEach(async () => {
    partnersServiceMock.findBusinessProfile.mockReset();
    partnersServiceMock.updateBusinessProfile.mockReset();

    // The controller is guarded by real SupabaseAuthGuard/PartnerAccessGuard
    // classes (referenced by type in @UseGuards), so compiling the module
    // would otherwise try to resolve their real dependencies (AuthService,
    // PrismaService, ...). We call controller methods directly in these
    // tests, bypassing guards entirely, so a no-op override is enough.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BusinessProfileController],
      providers: [{ provide: PartnersService, useValue: partnersServiceMock }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PartnerAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BusinessProfileController>(BusinessProfileController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // The guard's own authorization logic (no membership, inactive partner,
  // wrong partner, etc.) is exhaustively covered by partner-access.guard.spec.ts.
  // This only proves the guard chain is actually wired onto this controller.
  it('is protected by SupabaseAuthGuard and PartnerAccessGuard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, BusinessProfileController);

    expect(guards).toEqual([SupabaseAuthGuard, PartnerAccessGuard]);
  });

  describe('GET /partner/business-profile', () => {
    it("uses the partner resolved through the authenticated user's membership", async () => {
      const profile = { id: PARTNER.partnerId, name: 'Studio' };
      partnersServiceMock.findBusinessProfile.mockResolvedValue(profile);

      const result = await controller.findOne(PARTNER);

      expect(partnersServiceMock.findBusinessProfile).toHaveBeenCalledWith(
        PARTNER.partnerId,
      );
      expect(result).toBe(profile);
    });
  });

  describe('PATCH /partner/business-profile', () => {
    it("updates the partner resolved through the authenticated user's membership", async () => {
      const dto = { name: 'New Name' };
      const updated = { id: PARTNER.partnerId, name: 'New Name' };
      partnersServiceMock.updateBusinessProfile.mockResolvedValue(updated);

      const result = await controller.update(PARTNER, dto);

      expect(partnersServiceMock.updateBusinessProfile).toHaveBeenCalledWith(
        PARTNER.partnerId,
        dto,
      );
      expect(result).toBe(updated);
    });
  });
});
