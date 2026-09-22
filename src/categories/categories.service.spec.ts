import { Test } from '@nestjs/testing';
import { CategoriesService } from './categories.service.js';
import { PrismaService } from '../lib/database/prisma.service.js';

describe('CategoriesService', () => {
  const mockCategories = [
    {
      id: 'parent-1',
      name: 'Sports & Movement',
      slug: 'sports-movement',
      description: null,
      children: [
        {
          id: 'child-1',
          name: 'Yoga',
          slug: 'yoga',
          description: null,
        },
      ],
    },
  ];

  const prismaMock = {
    category: {
      findMany: vi.fn(),
    },
  };

  let service: CategoriesService;

  beforeEach(async () => {
    prismaMock.category.findMany.mockReset();

    const module = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get(CategoriesService);
  });

  it('returns parent categories with their children', async () => {
    prismaMock.category.findMany.mockResolvedValue(mockCategories);

    const result = await service.findAll();

    expect(prismaMock.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { parentId: null },
        select: expect.objectContaining({
          children: expect.objectContaining({
            select: expect.objectContaining({
              id: true,
              name: true,
              slug: true,
            }),
          }),
        }),
      }),
    );

    expect(result).toEqual(mockCategories);
  });

  it('filters by name when a search term is provided', async () => {
    prismaMock.category.findMany.mockResolvedValue(mockCategories);

    await service.findAll('yoga');

    expect(prismaMock.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          parentId: null,
          name: { contains: 'yoga', mode: 'insensitive' },
        },
      }),
    );
  });
});
