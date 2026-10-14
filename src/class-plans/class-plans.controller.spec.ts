import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard.js';
import { PartnerAccessGuard } from '../partners/guards/partner-access.guard.js';
import type { PartnerContext } from '../partners/types/partner-context.js';
import { ClassPlansController } from './class-plans.controller.js';
import { ClassPlansService } from './class-plans.service.js';
import { CreateClassPlanDto } from './dto/create-class-plan.dto.js';

const PARTNER: PartnerContext = {
  partnerId: '11111111-1111-4111-8111-111111111111',
  membershipRole: 'OWNER',
};

describe('ClassPlansController', () => {
  const classPlansServiceMock = { findAll: vi.fn(), create: vi.fn() };

  let controller: ClassPlansController;

  beforeEach(async () => {
    classPlansServiceMock.findAll.mockReset();
    classPlansServiceMock.create.mockReset();

    // Guards are bypassed: tests call controller methods directly.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClassPlansController],
      providers: [
        { provide: ClassPlansService, useValue: classPlansServiceMock },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PartnerAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ClassPlansController);
  });

  it('is protected by SupabaseAuthGuard then PartnerAccessGuard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ClassPlansController);

    expect(guards).toEqual([SupabaseAuthGuard, PartnerAccessGuard]);
  });

  it('lists plans for the verified partner', async () => {
    classPlansServiceMock.findAll.mockResolvedValue([{ id: 'plan-1' }]);

    const result = await controller.findAll(PARTNER);

    expect(classPlansServiceMock.findAll).toHaveBeenCalledWith(
      PARTNER.partnerId,
    );
    expect(result).toEqual([{ id: 'plan-1' }]);
  });

  it('creates a plan for the verified partner', async () => {
    const dto = { classTypeId: 'ct-1' } as CreateClassPlanDto;
    classPlansServiceMock.create.mockResolvedValue({ id: 'plan-1' });

    const result = await controller.create(PARTNER, dto);

    expect(classPlansServiceMock.create).toHaveBeenCalledWith(
      PARTNER.partnerId,
      dto,
    );
    expect(result).toEqual({ id: 'plan-1' });
  });
});
