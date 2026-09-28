import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../lib/database/prisma.service.js';
import { PartnerBusinessProfileResponseDto } from './dto/partner-business-profile-response.dto.js';
import { PartnerResponseDto } from './dto/partner-response.dto.js';
import { UpdatePartnerBusinessProfileDto } from './dto/update-partner-business-profile.dto.js';

const BUSINESS_PROFILE_SELECT = {
  id: true,
  name: true,
  description: true,
  phone: true,
  websiteUrl: true,
  facebookUrl: true,
  instagramHandle: true,
  xHandle: true,
  tiktokHandle: true,
  bookingCutoffMinutes: true,
} as const;

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

  // partnerId must be the verified id from @CurrentPartner(), never a raw param.
  async findBusinessProfile(
    partnerId: string,
  ): Promise<PartnerBusinessProfileResponseDto> {
    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
      select: BUSINESS_PROFILE_SELECT,
    });

    // The guard just proved this partner exists; this only covers a delete
    // happening between the guard and this query.
    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    return partner;
  }

  // partnerId must be the verified id from @CurrentPartner(), never a raw param.
  async updateBusinessProfile(
    partnerId: string,
    dto: UpdatePartnerBusinessProfileDto,
  ): Promise<PartnerBusinessProfileResponseDto> {
    // With whitelist + transform, absent fields can still exist as undefined.
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('Provide at least one field to update');
    }

    try {
      return await this.prisma.partner.update({
        where: { id: partnerId },
        data: dto,
        select: BUSINESS_PROFILE_SELECT,
      });
    } catch (error) {
      // The guard just proved this partner exists; this only covers a delete
      // happening between the guard and this query.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Partner not found');
      }
      throw error;
    }
  }
}
