import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { VenueStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../lib/database/prisma.service.js';
import { CreateVenueDto } from './dto/create-venue.dto.js';
import { UpdateVenueDto } from './dto/update-venue.dto.js';
import { VenueResponseDto } from './dto/venue-response.dto.js';

// Everything except partnerId: clients never need it, and it keeps the shape explicit.
const VENUE_SELECT = {
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

// Every method takes the verified partnerId from @CurrentPartner(), never a
// value from the URL or body, and every query is filtered by it.
@Injectable()
export class VenuesService {
  constructor(private readonly prisma: PrismaService) {}

  // Archived venues are hidden by default; there is no way to list them yet.
  findAll(partnerId: string): Promise<VenueResponseDto[]> {
    return this.prisma.venue.findMany({
      where: { partnerId, status: VenueStatus.ACTIVE },
      select: VENUE_SELECT,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  // status is not in the DTO, so the schema default (ACTIVE) applies.
  create(partnerId: string, dto: CreateVenueDto): Promise<VenueResponseDto> {
    return this.prisma.venue.create({
      data: { ...dto, partnerId },
      select: VENUE_SELECT,
    });
  }

  async update(
    partnerId: string,
    venueId: string,
    dto: UpdateVenueDto,
  ): Promise<VenueResponseDto> {
    // With whitelist + transform, absent fields can still exist as undefined.
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('Provide at least one field to update');
    }

    await this.assertOwnedVenue(partnerId, venueId);

    return this.prisma.venue.update({
      where: { id: venueId },
      data: dto,
      select: VENUE_SELECT,
    });
  }

  // Soft delete: the row stays so past and future class data can keep pointing at it.
  // Archiving an already archived venue is a harmless no-op (idempotent).
  async archive(partnerId: string, venueId: string): Promise<VenueResponseDto> {
    await this.assertOwnedVenue(partnerId, venueId);

    return this.prisma.venue.update({
      where: { id: venueId },
      data: { status: VenueStatus.ARCHIVED },
      select: VENUE_SELECT,
    });
  }

  // Throws 404 unless this venue belongs to this partner. A venue that
  // belongs to a different partner throws the exact same 404 as a venue that
  // doesn't exist at all, so a caller can never tell the two apart.
  private async assertOwnedVenue(
    partnerId: string,
    venueId: string,
  ): Promise<void> {
    const venue = await this.prisma.venue.findFirst({
      where: { id: venueId, partnerId },
      select: { id: true },
    });

    if (!venue) {
      throw new NotFoundException('Venue not found');
    }
  }
}
