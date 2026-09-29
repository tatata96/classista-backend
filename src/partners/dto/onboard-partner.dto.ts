import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { OnboardPartnerBusinessInfoDto } from './onboard-partner-business-info.dto.js';
import { OnboardPartnerVenueDto } from './onboard-partner-venue.dto.js';

// Both partner and venue are required: onboarding always creates all three
// rows (Partner, OWNER PartnerMembership, Venue) together, in one transaction.
// No userId, partnerId, or role field here: those are derived/hardcoded
// server-side from the authenticated request, never taken from the client.
export class OnboardPartnerDto {
  @ApiProperty({ type: OnboardPartnerBusinessInfoDto })
  @ValidateNested()
  @Type(() => OnboardPartnerBusinessInfoDto)
  partner: OnboardPartnerBusinessInfoDto;

  @ApiProperty({ type: OnboardPartnerVenueDto })
  @ValidateNested()
  @Type(() => OnboardPartnerVenueDto)
  venue: OnboardPartnerVenueDto;
}
