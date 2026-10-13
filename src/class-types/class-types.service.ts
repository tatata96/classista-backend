import { Injectable } from '@nestjs/common';
import { PrismaService } from '../lib/database/prisma.service.js';
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
}
