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
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
  };

  let controller: ClassTypesController;

  beforeEach(async () => {
    classTypesServiceMock.findAll.mockReset();
    classTypesServiceMock.create.mockReset();
    classTypesServiceMock.update.mockReset();
    classTypesServiceMock.archive.mockReset();

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

  describe('POST /partner/class-types', () => {
    it('creates with the verified partner id and the dto', async () => {
      const dto = { name: 'Puppy Yoga', categoryId: 'cat-1' };
      const created = { id: 'ct-1' };
      classTypesServiceMock.create.mockResolvedValue(created);

      const result = await controller.create(PARTNER, dto);

      expect(classTypesServiceMock.create).toHaveBeenCalledWith(
        PARTNER.partnerId,
        dto,
      );
      expect(result).toBe(created);
    });
  });

  describe('PATCH /partner/class-types/:id', () => {
    it('updates with the verified partner id, the path id and the dto', async () => {
      const id = '44444444-4444-4444-8444-444444444444';
      const dto = { name: 'New name' };
      const updated = { id };
      classTypesServiceMock.update.mockResolvedValue(updated);

      const result = await controller.update(PARTNER, id, dto);

      expect(classTypesServiceMock.update).toHaveBeenCalledWith(
        PARTNER.partnerId,
        id,
        dto,
      );
      expect(result).toBe(updated);
    });
  });

  describe('POST /partner/class-types/:id/archive', () => {
    it('archives with the verified partner id and the path id', async () => {
      const id = '44444444-4444-4444-8444-444444444444';
      const archived = { id, isActive: false };
      classTypesServiceMock.archive.mockResolvedValue(archived);

      const result = await controller.archive(PARTNER, id);

      expect(classTypesServiceMock.archive).toHaveBeenCalledWith(
        PARTNER.partnerId,
        id,
      );
      expect(result).toBe(archived);
    });

    it('responds 200, not 201', () => {
      expect(
        Reflect.getMetadata(
          '__httpCode__',
          ClassTypesController.prototype.archive,
        ),
      ).toBe(200);
    });
  });
});
