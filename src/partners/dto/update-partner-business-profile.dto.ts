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

  // null explicitly clears the field; undefined (the field absent from the
  // request body) leaves it unchanged. @IsOptional() skips the validators
  // below for both null and undefined, so only non-null values are checked.
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '+90 216 555 00 00' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'https://kadikoyyoga.com' })
  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  websiteUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'https://facebook.com/kadikoyyoga' })
  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  facebookUrl?: string | null;

  // Handles, not full profile URLs (e.g. "kadikoyyoga", not a URL).
  @ApiPropertyOptional({ type: String, nullable: true, example: 'kadikoyyoga' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  instagramHandle?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'kadikoyyoga' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  xHandle?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'kadikoyyoga' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  tiktokHandle?: string | null;

  @ApiPropertyOptional({
    example: 720,
    description: 'Minutes before a class starts that bookings close',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  bookingCutoffMinutes?: number;
}
