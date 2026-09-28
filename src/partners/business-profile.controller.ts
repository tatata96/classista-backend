import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard.js';
import { CurrentPartner } from './decorators/current-partner.decorator.js';
import { PartnerBusinessProfileResponseDto } from './dto/partner-business-profile-response.dto.js';
import { UpdatePartnerBusinessProfileDto } from './dto/update-partner-business-profile.dto.js';
import { PartnerAccessGuard } from './guards/partner-access.guard.js';
import { PartnersService } from './partners.service.js';
import type { PartnerContext } from './types/partner-context.js';

// "/partner/..." has no :partnerId: PartnerAccessGuard resolves the partner
// from the authenticated user's own membership.
@ApiTags('Partner business profile')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@ApiForbiddenResponse({
  description: 'Not a partner member, or the partner is inactive',
})
@UseGuards(SupabaseAuthGuard, PartnerAccessGuard)
@Controller('partner/business-profile')
export class BusinessProfileController {
  constructor(private readonly partnersService: PartnersService) {}

  @Get()
  @ApiOkResponse({
    description: "Returns the partner's business profile",
    type: PartnerBusinessProfileResponseDto,
  })
  findOne(
    @CurrentPartner() partner: PartnerContext,
  ): Promise<PartnerBusinessProfileResponseDto> {
    return this.partnersService.findBusinessProfile(partner.partnerId);
  }

  @Patch()
  @ApiOkResponse({
    description: "Updates the partner's business profile",
    type: PartnerBusinessProfileResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid or empty request body' })
  update(
    @CurrentPartner() partner: PartnerContext,
    @Body() dto: UpdatePartnerBusinessProfileDto,
  ): Promise<PartnerBusinessProfileResponseDto> {
    return this.partnersService.updateBusinessProfile(partner.partnerId, dto);
  }
}
