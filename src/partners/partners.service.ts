import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../lib/database/prisma.service.js';
import { PartnerResponseDto } from './dto/partner-response.dto.js';

@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaService) {}

  // partnerId must be the verified id from @CurrentPartner(), never a raw param.
  async findOne(partnerId: string): Promise<PartnerResponseDto> {
    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
      select: { id: true, name: true, description: true, status: true },
    });

    // The guard just proved this partner exists; this only covers a delete
    // happening between the guard and this query.
    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    return partner;
  }
}
