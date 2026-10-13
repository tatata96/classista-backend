import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard.js';
import { PartnerAccessGuard } from '../partners/guards/partner-access.guard.js';
import type { PartnerContext } from '../partners/types/partner-context.js';
import { ClassTypesController } from './class-types.controller.js';
import { ClassTypesService } from './class-types.service.js';

const PARTNER: PartnerContext = {
  partnerId: '11111111-1111-4111-8111-111111111111',
  membershipRole: 'OWNER',
};

describe('ClassTypesController', () => {
  const classTypesServiceMock = {
    findAll: vi.fn(),
  };

  let controller: ClassTypesController;

  beforeEach(async () => {
    classTypesServiceMock.findAll.mockReset();

    // Guards are bypassed: tests call controller methods directly.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClassTypesController],
      providers: [
        { provide: ClassTypesService, useValue: classTypesServiceMock },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PartnerAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ClassTypesController);
  });

  it('is protected by SupabaseAuthGuard then PartnerAccessGuard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ClassTypesController);

    expect(guards).toEqual([SupabaseAuthGuard, PartnerAccessGuard]);
  });

  describe('GET /partner/class-types', () => {
    it('lists with the verified partner id and the requested filter', async () => {
      const rows = [{ id: 'ct-1' }];
      classTypesServiceMock.findAll.mockResolvedValue(rows);

      const result = await controller.findAll(PARTNER, { isActive: false });

      expect(classTypesServiceMock.findAll).toHaveBeenCalledWith(
        PARTNER.partnerId,
        false,
      );
      expect(result).toBe(rows);
    });

    it('passes an omitted filter through as undefined', async () => {
      classTypesServiceMock.findAll.mockResolvedValue([]);

      await controller.findAll(PARTNER, {});

      expect(classTypesServiceMock.findAll).toHaveBeenCalledWith(
        PARTNER.partnerId,
        undefined,
      );
    });
  });
});
