import { Test } from '@nestjs/testing';
import { PrismaService } from '../lib/database/prisma.service.js';
import { ClassTypesService } from './class-types.service.js';

const PARTNER_ID = '11111111-1111-4111-8111-111111111111';

describe('ClassTypesService', () => {
  const prismaMock = {
    classType: {
      findMany: vi.fn(),
    },
  };

  let service: ClassTypesService;

  beforeEach(async () => {
    prismaMock.classType.findMany.mockReset();

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
});
