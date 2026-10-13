import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../lib/database/prisma.service.js';
import { CreateClassTypeDto } from './dto/create-class-type.dto.js';
import { ClassTypeResponseDto } from './dto/class-type-response.dto.js';

// Everything except partnerId and imageUrl (image management is deferred).
// TODO:imageUrl
const CLASS_TYPE_SELECT = {
  id: true,
  name: true,
  description: true,
  isActive: true,
  categoryId: true,
  category: { select: { id: true, name: true } },
  createdAt: true,
  updatedAt: true,
} as const;

// Every method takes the verified partnerId from @CurrentPartner(), never a
// value from the URL or body, and every query is filtered by it.
@Injectable()
export class ClassTypesService {
  constructor(private readonly prisma: PrismaService) {}

  // Active types by default; isActive=false lists the archived ones.
  findAll(
    partnerId: string,
    isActive: boolean = true,
  ): Promise<ClassTypeResponseDto[]> {
    return this.prisma.classType.findMany({
      where: { partnerId, isActive },
      select: CLASS_TYPE_SELECT,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  // partnerId comes from the authenticated partner; isActive is not in the DTO,
  // so the schema default (true) applies.
  async create(
    partnerId: string,
    dto: CreateClassTypeDto,
  ): Promise<ClassTypeResponseDto> {
    await this.assertLeafCategory(dto.categoryId);

    return this.prisma.classType.create({
      data: { ...dto, partnerId },
      select: CLASS_TYPE_SELECT,
    });
  }

  // Categories are shared reference data, so there is no partner check here.
  // A class type must sit on a leaf (no children), never on a parent group.
  private async assertLeafCategory(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { _count: { select: { children: true } } },
    });

    if (!category) {
      throw new BadRequestException('categoryId does not exist');
    }

    if (category._count.children > 0) {
      throw new BadRequestException(
        'categoryId must be a leaf category (one without subcategories)',
      );
    }
  }
}
