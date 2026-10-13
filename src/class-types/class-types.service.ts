import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../lib/database/prisma.service.js';
import { CreateClassTypeDto } from './dto/create-class-type.dto.js';
import { UpdateClassTypeDto } from './dto/update-class-type.dto.js';
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

  async update(
    partnerId: string,
    classTypeId: string,
    dto: UpdateClassTypeDto,
  ): Promise<ClassTypeResponseDto> {
    // With whitelist + transform, absent fields can still exist as undefined.
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const classType = await this.prisma.classType.findFirst({
      where: { id: classTypeId, partnerId },
      select: { isActive: true },
    });

    // Another partner's type gets the exact same 404 as a type that doesn't
    // exist, so a caller can never tell the two apart.
    if (!classType) {
      throw new NotFoundException('Class Type not found');
    }

    // Archived types are read-only. The type exists, but its current state
    // conflicts with the edit, hence 409 rather than 404 or 400.
    if (!classType.isActive) {
      throw new ConflictException('Archived Class Types cannot be edited.');
    }

    if (dto.categoryId !== undefined) {
      await this.assertLeafCategory(dto.categoryId);
    }

    // isActive: true makes the write itself refuse an archived row, so a
    // request that archives this type between the check above and this update
    // cannot be overtaken. Prisma then reports "record not found" (P2025),
    // which we translate to the same 409 the check above gives.
    try {
      return await this.prisma.classType.update({
        where: { id: classTypeId, partnerId, isActive: true },
        data: dto,
        select: CLASS_TYPE_SELECT,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new ConflictException('Archived Class Types cannot be edited.');
      }
      throw error;
    }
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
