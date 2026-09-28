import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

// Every field optional: this is a partial update, same convention as
// UpdateVenueDto. Absent fields are left unchanged.
export class UpdatePartnerBusinessProfileDto {
  // @IsOptional() alone would also accept null (it skips validation for both
  // null and undefined), but name must never be nullable. ValidateIf skips
  // validation only when the field is truly absent (undefined); an explicit
  // null still reaches IsString/IsNotEmpty and is rejected by them.
  @ApiPropertyOptional({ example: 'Kadıköy Yoga Studio' })
  @ValidateIf((_object, value) => value !== undefined)
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

  // Same reasoning as name above: ValidateIf, not IsOptional, so null is
  // rejected instead of silently skipped.
  @ApiPropertyOptional({
    example: 720,
    description: 'Minutes before a class starts that bookings close',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  bookingCutoffMinutes?: number;
}
