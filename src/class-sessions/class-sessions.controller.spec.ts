import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard.js';
import { PartnerAccessGuard } from '../partners/guards/partner-access.guard.js';
import type { PartnerContext } from '../partners/types/partner-context.js';
import { ClassSessionsController } from './class-sessions.controller.js';
import { ClassSessionsService } from './class-sessions.service.js';

const PARTNER: PartnerContext = {
  partnerId: '11111111-1111-4111-8111-111111111111',
  membershipRole: 'OWNER',
};

describe('ClassSessionsController', () => {
  const serviceMock = { findByDate: vi.fn() };
  let controller: ClassSessionsController;

  beforeEach(async () => {
    serviceMock.findByDate.mockReset();

    // Guards are bypassed: tests call controller methods directly.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClassSessionsController],
      providers: [{ provide: ClassSessionsService, useValue: serviceMock }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PartnerAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ClassSessionsController);
  });

  it('is protected by SupabaseAuthGuard then PartnerAccessGuard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      ClassSessionsController,
    );

    expect(guards).toEqual([SupabaseAuthGuard, PartnerAccessGuard]);
  });

  it('lists sessions for the verified partner and the requested date', async () => {
    serviceMock.findByDate.mockResolvedValue([{ id: 'session-1' }]);

    const result = await controller.findByDate(PARTNER, { date: '2026-10-14' });

    expect(serviceMock.findByDate).toHaveBeenCalledWith(
      PARTNER.partnerId,
      '2026-10-14',
    );
    expect(result).toEqual([{ id: 'session-1' }]);
  });
});
