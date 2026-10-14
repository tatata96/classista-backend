import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateVenueDto } from '../../venues/dto/create-venue.dto.js';

// : Classista is Turkey-only for the MVP: timezone is not a client field
export class OnboardPartnerVenueDto extends OmitType(CreateVenueDto, [
  'name',
] as const) {
  // Optional here, unlike CreateVenueDto: asking for both a business name and
  // a venue name is repetitive when a partner is onboarding with a single
  // location. When omitted, the onboarding service falls back to
  // OnboardPartnerDto.partner.name.
  @ApiPropertyOptional({
    example: 'Main Studio',
    description: "Defaults to the partner's business name if omitted",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;
}
