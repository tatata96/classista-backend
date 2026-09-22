import { Test } from '@nestjs/testing';
import { CategoriesController } from './categories/categories.controller.js';
import { CategoriesService } from './categories/categories.service.js';

describe('CategoriesController', () => {
  const categories = [
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

  const categoriesServiceMock = {
    findAll: vi.fn(),
  };

  let controller: CategoriesController;

  beforeEach(async () => {
    categoriesServiceMock.findAll.mockReset();

    const module = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        {
          provide: CategoriesService,
          useValue: categoriesServiceMock,
        },
      ],
    }).compile();

    controller = module.get(CategoriesController);
  });

  it('returns categories with nested subcategories', async () => {
    categoriesServiceMock.findAll.mockResolvedValue(categories);

    const result = await controller.findAll({});

    expect(categoriesServiceMock.findAll).toHaveBeenCalledOnce();
    expect(result).toEqual(categories);
  });
});
