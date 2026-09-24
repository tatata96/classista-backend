import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard.js';
import { CurrentPartner } from './decorators/current-partner.decorator.js';
import { PartnerResponseDto } from './dto/partner-response.dto.js';
import { PartnerAccessGuard } from './guards/partner-access.guard.js';
import { PartnersService } from './partners.service.js';
import type { PartnerContext } from './types/partner-context.js';

@ApiTags('Partners')
@ApiBearerAuth()
@Controller('partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  // Guards run in the order listed: authenticate first, then authorize.
  @Get(':partnerId')
  @UseGuards(SupabaseAuthGuard, PartnerAccessGuard)
  @ApiOkResponse({ description: 'Returns the partner profile', type: PartnerResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  @ApiForbiddenResponse({
    description: 'Not a member of this partner, the partner does not exist, or it is inactive',
  })
  findOne(@CurrentPartner() partner: PartnerContext): Promise<PartnerResponseDto> {
    return this.partnersService.findOne(partner.partnerId);
  }
}
