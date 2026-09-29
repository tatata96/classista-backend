import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard.js';
import { CurrentPartner } from './decorators/current-partner.decorator.js';
import { OnboardPartnerDto } from './dto/onboard-partner.dto.js';
import { OnboardPartnerResponseDto } from './dto/onboard-partner-response.dto.js';
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

  // No PartnerAccessGuard: a user calling this has no PartnerMembership yet,
  // so that guard would always reject them. SupabaseAuthGuard alone is
  // enough to know who is onboarding.
  @Post('onboarding')
  @UseGuards(SupabaseAuthGuard)
  @ApiCreatedResponse({
    description: 'Creates the partner, an OWNER membership, and the first venue',
    type: OnboardPartnerResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  @ApiConflictResponse({ description: 'This user has already completed onboarding' })
  async onboard(
    @Req() request: Request,
    @Body() dto: OnboardPartnerDto,
  ): Promise<OnboardPartnerResponseDto> {
    if (!request.user) {
      throw new UnauthorizedException();
    }

    return this.partnersService.onboard(request.user.id, dto);
  }
}
