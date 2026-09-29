import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// A separate, smaller DTO from UpdatePartnerBusinessProfileDto on purpose:
// that DTO's fields are optional-if-absent (PATCH semantics), but onboarding
// is a creation step where name is genuinely required.
export class OnboardPartnerBusinessInfoDto {
  @ApiProperty({ example: 'Kadıköy Yoga Studio' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description?: string;
}
