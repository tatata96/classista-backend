import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { VenueAmenity } from '../venue-amenity.js';

// No partnerId, status, or timezone: the partner comes from the authenticated
// user, a new venue is always ACTIVE
// (Classista is Turkey-only for the MVP, use VENUE_TIMEZONE).
export class CreateVenueDto {
  @ApiProperty({ example: 'Kadıköy Studio' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'Bahariye Caddesi 12' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  addressLine: string;

  @ApiProperty({ example: 'Kadıköy' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  district: string;

  @ApiProperty({ example: 'Istanbul' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @ApiPropertyOptional({ example: '34710' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({ example: '+90 216 555 00 00' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: 40.9903, minimum: -90, maximum: 90 })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 29.0287, minimum: -180, maximum: 180 })
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ enum: VenueAmenity, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(VenueAmenity, { each: true })
  amenityIds?: VenueAmenity[];
}
