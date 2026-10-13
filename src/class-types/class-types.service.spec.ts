import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../lib/database/prisma.service.js';
import { ClassTypesService } from './class-types.service.js';

const PARTNER_ID = '11111111-1111-4111-8111-111111111111';

describe('ClassTypesService', () => {
  const prismaMock = {
    classType: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    category: {
      findUnique: vi.fn(),
    },
  };

  let service: ClassTypesService;

  beforeEach(async () => {
    prismaMock.classType.findMany.mockReset();
    prismaMock.classType.create.mockReset();
    prismaMock.classType.findFirst.mockReset();
    prismaMock.classType.update.mockReset();
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

  describe('update', () => {
    const CLASS_TYPE_ID = '44444444-4444-4444-8444-444444444444';
    const CATEGORY_ID = '33333333-3333-4333-8333-333333333333';

    function givenActiveClassType() {
      prismaMock.classType.findFirst.mockResolvedValue({ isActive: true });
    }

    it('updates an active type owned by the partner', async () => {
      givenActiveClassType();
      const updated = { id: CLASS_TYPE_ID, name: 'New name' };
      prismaMock.classType.update.mockResolvedValue(updated);

      const result = await service.update(PARTNER_ID, CLASS_TYPE_ID, {
        name: 'New name',
      });

      expect(prismaMock.classType.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CLASS_TYPE_ID, partnerId: PARTNER_ID },
        }),
      );
      expect(prismaMock.classType.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CLASS_TYPE_ID, partnerId: PARTNER_ID, isActive: true },
          data: { name: 'New name' },
        }),
      );
      expect(result).toBe(updated);
    });

    it('returns 409 when the type is archived between the check and the write', async () => {
      givenActiveClassType();
      prismaMock.classType.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Record not found', {
          code: 'P2025',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.update(PARTNER_ID, CLASS_TYPE_ID, { name: 'New name' }),
      ).rejects.toThrow(
        new ConflictException('Archived Class Types cannot be edited.'),
      );
    });

    it('rethrows other database errors untouched', async () => {
      givenActiveClassType();
      const failure = new Error('connection lost');
      prismaMock.classType.update.mockRejectedValue(failure);

      await expect(
        service.update(PARTNER_ID, CLASS_TYPE_ID, { name: 'New name' }),
      ).rejects.toBe(failure);
    });

    it('returns 404 for a type that does not exist or belongs to another partner', async () => {
      prismaMock.classType.findFirst.mockResolvedValue(null);

      await expect(
        service.update(PARTNER_ID, CLASS_TYPE_ID, { name: 'New name' }),
      ).rejects.toThrow(new NotFoundException('Class Type not found'));
      expect(prismaMock.classType.update).not.toHaveBeenCalled();
    });

    it('returns 409 for an archived type and changes nothing', async () => {
      prismaMock.classType.findFirst.mockResolvedValue({ isActive: false });

      await expect(
        service.update(PARTNER_ID, CLASS_TYPE_ID, { name: 'New name' }),
      ).rejects.toThrow(
        new ConflictException('Archived Class Types cannot be edited.'),
      );
      expect(prismaMock.classType.update).not.toHaveBeenCalled();
    });

    it('returns 400 for an empty body before touching the database', async () => {
      await expect(
        service.update(PARTNER_ID, CLASS_TYPE_ID, {}),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.classType.findFirst).not.toHaveBeenCalled();
    });

    it('treats a body of only undefined fields as empty', async () => {
      await expect(
        service.update(PARTNER_ID, CLASS_TYPE_ID, { name: undefined }),
      ).rejects.toThrow(BadRequestException);
    });

    it('clears the description when it is null', async () => {
      givenActiveClassType();
      prismaMock.classType.update.mockResolvedValue({});

      await service.update(PARTNER_ID, CLASS_TYPE_ID, { description: null });

      expect(prismaMock.classType.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { description: null } }),
      );
    });

    it('accepts a new leaf category', async () => {
      givenActiveClassType();
      prismaMock.category.findUnique.mockResolvedValue({
        _count: { children: 0 },
      });
      prismaMock.classType.update.mockResolvedValue({});

      await service.update(PARTNER_ID, CLASS_TYPE_ID, {
        categoryId: CATEGORY_ID,
      });

      expect(prismaMock.classType.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { categoryId: CATEGORY_ID } }),
      );
    });

    it('rejects an unknown category with 400', async () => {
      givenActiveClassType();
      prismaMock.category.findUnique.mockResolvedValue(null);

      await expect(
        service.update(PARTNER_ID, CLASS_TYPE_ID, { categoryId: CATEGORY_ID }),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.classType.update).not.toHaveBeenCalled();
    });

    it('rejects a parent category with 400', async () => {
      givenActiveClassType();
      prismaMock.category.findUnique.mockResolvedValue({
        _count: { children: 31 },
      });

      await expect(
        service.update(PARTNER_ID, CLASS_TYPE_ID, { categoryId: CATEGORY_ID }),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.classType.update).not.toHaveBeenCalled();
    });

    it('does not check categories when categoryId is not being changed', async () => {
      givenActiveClassType();
      prismaMock.classType.update.mockResolvedValue({});

      await service.update(PARTNER_ID, CLASS_TYPE_ID, { name: 'New name' });

      expect(prismaMock.category.findUnique).not.toHaveBeenCalled();
    });

    it('reports an archived type before validating its category', async () => {
      prismaMock.classType.findFirst.mockResolvedValue({ isActive: false });

      await expect(
        service.update(PARTNER_ID, CLASS_TYPE_ID, { categoryId: CATEGORY_ID }),
      ).rejects.toThrow(ConflictException);
      expect(prismaMock.category.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('archive', () => {
    const CLASS_TYPE_ID = '44444444-4444-4444-8444-444444444444';

    it('sets isActive to false for an active type owned by the partner', async () => {
      prismaMock.classType.findFirst.mockResolvedValue({
        id: CLASS_TYPE_ID,
        isActive: true,
      });
      const archived = { id: CLASS_TYPE_ID, isActive: false };
      prismaMock.classType.update.mockResolvedValue(archived);

      const result = await service.archive(PARTNER_ID, CLASS_TYPE_ID);

      expect(prismaMock.classType.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CLASS_TYPE_ID, partnerId: PARTNER_ID },
        }),
      );
      expect(prismaMock.classType.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CLASS_TYPE_ID, partnerId: PARTNER_ID },
          data: { isActive: false },
        }),
      );
      expect(result).toBe(archived);
    });

    it('succeeds without writing when the type is already archived', async () => {
      const alreadyArchived = { id: CLASS_TYPE_ID, isActive: false };
      prismaMock.classType.findFirst.mockResolvedValue(alreadyArchived);

      const result = await service.archive(PARTNER_ID, CLASS_TYPE_ID);

      expect(result).toBe(alreadyArchived);
      expect(prismaMock.classType.update).not.toHaveBeenCalled();
    });

    it('returns 404 for a type that does not exist or belongs to another partner', async () => {
      prismaMock.classType.findFirst.mockResolvedValue(null);

      await expect(service.archive(PARTNER_ID, CLASS_TYPE_ID)).rejects.toThrow(
        new NotFoundException('Class Type not found'),
      );
      expect(prismaMock.classType.update).not.toHaveBeenCalled();
    });

    it('writes only isActive', async () => {
      prismaMock.classType.findFirst.mockResolvedValue({ isActive: true });
      prismaMock.classType.update.mockResolvedValue({});

      await service.archive(PARTNER_ID, CLASS_TYPE_ID);

      const { data } = prismaMock.classType.update.mock.calls[0][0];
      expect(data).toEqual({ isActive: false });
    });
  });
});
