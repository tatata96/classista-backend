import { Injectable } from '@nestjs/common';
import { PrismaService } from '../lib/database/prisma.service.js';
import { CLASS_LIST_SELECT, toClassListItem } from './catalog-selects.js';
import { visibleClassWhere } from './catalog-visibility.js';
import { CatalogClassPageDto } from './dto/catalog-class-response.dto.js';

// Public, read-only. There is no partner or user here: what may be returned is
// decided entirely by the rules in catalog-visibility.ts.
@Injectable()
export class CatalogClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async findPage(
    page: number,
    limit: number,
    now: Date = new Date(),
  ): Promise<CatalogClassPageDto> {
    // The same filter for both queries, so total always matches the items.
    const where = visibleClassWhere(now);

    const [total, classTypes] = await Promise.all([
      this.prisma.classType.count({ where }),
      this.prisma.classType.findMany({
        where,
        select: CLASS_LIST_SELECT,
        // id breaks ties so pages never overlap when names repeat.
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { items: classTypes.map(toClassListItem), total, page, limit };
  }
}
