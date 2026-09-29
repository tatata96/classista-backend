import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PartnerRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../lib/database/prisma.service.js';
import { OnboardPartnerDto } from './dto/onboard-partner.dto.js';
import { OnboardPartnerResponseDto } from './dto/onboard-partner-response.dto.js';
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

// Mirrors VenuesService's own VENUE_SELECT (everything except partnerId).
// Kept local, not imported, so onboarding doesn't touch the Venue module.
const ONBOARDING_VENUE_SELECT = {
  id: true,
  name: true,
  status: true,
  addressLine: true,
  district: true,
  city: true,
  postalCode: true,
  latitude: true,
  longitude: true,
  phone: true,
  timezone: true,
  amenityIds: true,
  createdAt: true,
  updatedAt: true,
} as const;

// Classista is Turkey-only for the MVP: onboarding sets every new venue's
// timezone to this instead of asking the client (see OnboardPartnerVenueDto).
const ONBOARDING_VENUE_TIMEZONE = 'Europe/Istanbul';

const ALREADY_ONBOARDED_MESSAGE = 'This user has already completed onboarding';

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

  // userId must be the verified id from the authenticated request
  // (request.user.id), never a client-supplied value. There is no
  // PartnerContext yet at this point: this user has no membership.
  async onboard(
    userId: string,
    dto: OnboardPartnerDto,
  ): Promise<OnboardPartnerResponseDto> {
    // Pre-check: cheap, avoids running the transaction for the common case
    // (double-click, or a client that missed the first success response).
    const existingMembership = await this.prisma.partnerMembership.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (existingMembership) {
      throw new ConflictException(ALREADY_ONBOARDED_MESSAGE);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const partner = await tx.partner.create({
          data: {
            name: dto.partner.name,
            description: dto.partner.description,
          },
          select: BUSINESS_PROFILE_SELECT,
        });

        // role: OWNER is hardcoded, not read from the client: this is the
        // first membership for a brand-new partner.
        await tx.partnerMembership.create({
          data: { userId, partnerId: partner.id, role: PartnerRole.OWNER },
        });

        const venue = await tx.venue.create({
          data: {
            ...dto.venue,
            // Falls back to the partner name so a single-location partner
            // isn't asked for the same name twice during onboarding.
            name: dto.venue.name ?? dto.partner.name,
            timezone: ONBOARDING_VENUE_TIMEZONE,
            partnerId: partner.id,
          },
          select: ONBOARDING_VENUE_SELECT,
        });

        return { partner, venue };
      });
    } catch (error) {
      // Race: two concurrent onboarding requests for the same user. The
      // pre-check above handles the common case; this is the database-level
      // backstop via PartnerMembership.userId's unique constraint.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(ALREADY_ONBOARDED_MESSAGE);
      }
      throw error;
    }
  }
}
