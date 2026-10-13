import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../lib/database/prisma.service.js';
import { ClassTypesService } from './class-types.service.js';

const PARTNER_ID = '11111111-1111-4111-8111-111111111111';

describe('ClassTypesService', () => {
  const prismaMock = {
    classType: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    category: {
      findUnique: vi.fn(),
    },
  };

  let service: ClassTypesService;

  beforeEach(async () => {
    prismaMock.classType.findMany.mockReset();
    prismaMock.classType.create.mockReset();
    prismaMock.category.findUnique.mockReset();

    const module = await Test.createTestingModule({
      providers: [
        ClassTypesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(ClassTypesService);
  });

  describe('findAll', () => {
    it('lists active types when no filter is given', async () => {
      const rows = [{ id: 'ct-1', name: 'Puppy Yoga' }];
      prismaMock.classType.findMany.mockResolvedValue(rows);

      const result = await service.findAll(PARTNER_ID);

      expect(prismaMock.classType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { partnerId: PARTNER_ID, isActive: true },
        }),
      );
      expect(result).toBe(rows);
    });

    it('lists archived types when isActive is false', async () => {
      prismaMock.classType.findMany.mockResolvedValue([]);

      await service.findAll(PARTNER_ID, false);

      expect(prismaMock.classType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { partnerId: PARTNER_ID, isActive: false },
        }),
      );
    });

    it('always scopes the query to the given partner', async () => {
      prismaMock.classType.findMany.mockResolvedValue([]);

      await service.findAll('22222222-2222-4222-8222-222222222222', true);

      const args = prismaMock.classType.findMany.mock.calls[0][0];
      expect(args.where.partnerId).toBe('22222222-2222-4222-8222-222222222222');
    });

    it('never selects partnerId or imageUrl', async () => {
      prismaMock.classType.findMany.mockResolvedValue([]);

      await service.findAll(PARTNER_ID);

      const { select } = prismaMock.classType.findMany.mock.calls[0][0];
      expect(select).not.toHaveProperty('partnerId');
      expect(select).not.toHaveProperty('imageUrl');
    });
  });

  describe('create', () => {
    const CATEGORY_ID = '33333333-3333-4333-8333-333333333333';
    const dto = { name: 'Puppy Yoga', categoryId: CATEGORY_ID };

    it('creates the type for the given partner when the category is a leaf', async () => {
      prismaMock.category.findUnique.mockResolvedValue({
        _count: { children: 0 },
      });
      const created = { id: 'ct-1', ...dto, isActive: true };
      prismaMock.classType.create.mockResolvedValue(created);

      const result = await service.create(PARTNER_ID, dto);

      expect(prismaMock.classType.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { ...dto, partnerId: PARTNER_ID } }),
      );
      expect(result).toBe(created);
    });

    it('takes partnerId from the argument, not from the dto', async () => {
      prismaMock.category.findUnique.mockResolvedValue({
        _count: { children: 0 },
      });
      prismaMock.classType.create.mockResolvedValue({});
      const spoofed = {
        ...dto,
        partnerId: '99999999-9999-4999-8999-999999999999',
      };

      await service.create(PARTNER_ID, spoofed);

      const { data } = prismaMock.classType.create.mock.calls[0][0];
      expect(data.partnerId).toBe(PARTNER_ID);
    });

    it('does not set isActive (the schema default applies)', async () => {
      prismaMock.category.findUnique.mockResolvedValue({
        _count: { children: 0 },
      });
      prismaMock.classType.create.mockResolvedValue({});

      await service.create(PARTNER_ID, dto);

      const { data } = prismaMock.classType.create.mock.calls[0][0];
      expect(data).not.toHaveProperty('isActive');
    });

    it('rejects an unknown category with 400 and creates nothing', async () => {
      prismaMock.category.findUnique.mockResolvedValue(null);

      await expect(service.create(PARTNER_ID, dto)).rejects.toThrow(
        new BadRequestException('categoryId does not exist'),
      );
      expect(prismaMock.classType.create).not.toHaveBeenCalled();
    });

    it('rejects a parent category (has children) with 400 and creates nothing', async () => {
      prismaMock.category.findUnique.mockResolvedValue({
        _count: { children: 31 },
      });

      await expect(service.create(PARTNER_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.classType.create).not.toHaveBeenCalled();
    });
  });
});
