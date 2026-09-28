import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

// Every field optional: this is a partial update, same convention as
// UpdateVenueDto. Absent fields are left unchanged.
export class UpdatePartnerBusinessProfileDto {
  @ApiPropertyOptional({ example: 'Kadıköy Yoga Studio' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: '+90 216 555 00 00' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: 'https://kadikoyyoga.com' })
  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  websiteUrl?: string;

  @ApiPropertyOptional({ example: 'https://facebook.com/kadikoyyoga' })
  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  facebookUrl?: string;

  // Handles, not full profile URLs (e.g. "kadikoyyoga", not a URL).
  @ApiPropertyOptional({ example: 'kadikoyyoga' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  instagramHandle?: string;

  @ApiPropertyOptional({ example: 'kadikoyyoga' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  xHandle?: string;

  @ApiPropertyOptional({ example: 'kadikoyyoga' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  tiktokHandle?: string;

  @ApiPropertyOptional({
    example: 720,
    description: 'Minutes before a class starts that bookings close',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  bookingCutoffMinutes?: number;
}
