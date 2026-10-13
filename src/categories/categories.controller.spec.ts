import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';

describe('CategoriesController', () => {
  const categoriesServiceMock = {
    findAll: vi.fn(),
  };

  let controller: CategoriesController;

  beforeEach(async () => {
    categoriesServiceMock.findAll.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        {
          provide: CategoriesService,
          useValue: categoriesServiceMock,
        },
      ],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns the category hierarchy from the service', async () => {
    const hierarchy = [
      {
        id: 'parent-1',
        name: 'Sport & Movement',
        slug: 'sports-movement',
        description: null,
        children: [],
      },
    ];
    categoriesServiceMock.findAll.mockResolvedValue(hierarchy);

    await expect(controller.findAll()).resolves.toEqual(hierarchy);
    expect(categoriesServiceMock.findAll).toHaveBeenCalledWith();
  });
});
