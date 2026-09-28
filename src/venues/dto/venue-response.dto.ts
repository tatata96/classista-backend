import { ApiProperty } from '@nestjs/swagger';
import { VenueStatus } from '../../generated/prisma/enums.js';
import { VenueAmenity } from '../venue-amenity.js';

export class VenueResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: VenueStatus })
  status: VenueStatus;

  @ApiProperty()
  addressLine: string;

  @ApiProperty()
  district: string;

  @ApiProperty()
  city: string;

  @ApiProperty({ type: String, nullable: true })
  postalCode: string | null;

  @ApiProperty({ type: Number, nullable: true })
  latitude: number | null;

  @ApiProperty({ type: Number, nullable: true })
  longitude: number | null;

  @ApiProperty({ type: String, nullable: true })
  phone: string | null;

  @ApiProperty()
  timezone: string;

  @ApiProperty({ enum: VenueAmenity, isArray: true })
  amenityIds: string[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
