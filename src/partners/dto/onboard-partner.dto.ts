import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { OnboardPartnerBusinessInfoDto } from './onboard-partner-business-info.dto.js';
import { OnboardPartnerVenueDto } from './onboard-partner-venue.dto.js';

// Both partner and venue are required: onboarding always creates all three
// rows (Partner, OWNER PartnerMembership, Venue) together, in one transaction.
// No userId, partnerId, or role field here: those are derived/hardcoded
// server-side from the authenticated request, never taken from the client.
export class OnboardPartnerDto {
  // @ValidateNested() alone only validates partner's own fields if it's
  // present; it does not require partner itself to exist. @IsDefined()
  // covers that (and, unlike @IsOptional()-based fields elsewhere in this
  // codebase, always runs even for undefined/null — that's the point).
  @ApiProperty({ type: OnboardPartnerBusinessInfoDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => OnboardPartnerBusinessInfoDto)
  partner: OnboardPartnerBusinessInfoDto;

  @ApiProperty({ type: OnboardPartnerVenueDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => OnboardPartnerVenueDto)
  venue: OnboardPartnerVenueDto;
}
