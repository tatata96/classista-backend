import { Test } from '@nestjs/testing';
import { PrismaService } from '../lib/database/prisma.service.js';
import { CatalogClassesService } from './catalog-classes.service.js';

// The visibility rules are proven against a real database in
// test/integration/catalog.integration-spec.ts.
describe('CatalogClassesService', () => {
  const prismaMock = {
    classType: { count: vi.fn(), findMany: vi.fn() },
  };
  let service: CatalogClassesService;

  beforeEach(async () => {
    prismaMock.classType.count.mockReset().mockResolvedValue(0);
    prismaMock.classType.findMany.mockReset().mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        CatalogClassesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(CatalogClassesService);
  });

  it('turns the page number into the rows to skip', async () => {
    await service.findPage(3, 10);

    expect(prismaMock.classType.findMany.mock.calls[0][0]).toMatchObject({
      skip: 20,
      take: 10,
    });
  });
});
