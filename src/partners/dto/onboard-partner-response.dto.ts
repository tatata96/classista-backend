import { ApiProperty } from '@nestjs/swagger';
import { VenueResponseDto } from '../../venues/dto/venue-response.dto.js';
import { PartnerBusinessProfileResponseDto } from './partner-business-profile-response.dto.js';

export class OnboardPartnerResponseDto {
  @ApiProperty({ type: PartnerBusinessProfileResponseDto })
  partner: PartnerBusinessProfileResponseDto;

  @ApiProperty({ type: VenueResponseDto })
  venue: VenueResponseDto;
}
