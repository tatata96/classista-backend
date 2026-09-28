import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard.js';
import { CurrentPartner } from '../partners/decorators/current-partner.decorator.js';
import { PartnerAccessGuard } from '../partners/guards/partner-access.guard.js';
import type { PartnerContext } from '../partners/types/partner-context.js';
import { CreateVenueDto } from './dto/create-venue.dto.js';
import { UpdateVenueDto } from './dto/update-venue.dto.js';
import { VenueResponseDto } from './dto/venue-response.dto.js';
import { VenuesService } from './venues.service.js';

// "/partner/..." has no :partnerId: PartnerAccessGuard resolves the partner
// from the authenticated user's own membership.
@ApiTags('Partner venues')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@ApiForbiddenResponse({
  description: 'Not a partner member, or the partner is inactive',
})
@UseGuards(SupabaseAuthGuard, PartnerAccessGuard)
@Controller('partner/venues')
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Get()
  @ApiOkResponse({
    description: "Lists the partner's ACTIVE venues",
    type: [VenueResponseDto],
  })
  findAll(
    @CurrentPartner() partner: PartnerContext,
  ): Promise<VenueResponseDto[]> {
    return this.venuesService.findAll(partner.partnerId);
  }

  @Post()
  @ApiCreatedResponse({
    description: 'Creates an ACTIVE venue for the partner',
    type: VenueResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid request body' })
  create(
    @CurrentPartner() partner: PartnerContext,
    @Body() dto: CreateVenueDto,
  ): Promise<VenueResponseDto> {
    return this.venuesService.create(partner.partnerId, dto);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Updates the venue', type: VenueResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid or empty request body, or malformed id',
  })
  @ApiNotFoundResponse({ description: 'No such venue for this partner' })
  update(
    @CurrentPartner() partner: PartnerContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVenueDto,
  ): Promise<VenueResponseDto> {
    return this.venuesService.update(partner.partnerId, id, dto);
  }

  // A POST action rather than DELETE: the venue is kept, only its status changes.
  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Archives the venue (status ARCHIVED)',
    type: VenueResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Malformed id' })
  @ApiNotFoundResponse({ description: 'No such venue for this partner' })
  archive(
    @CurrentPartner() partner: PartnerContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VenueResponseDto> {
    return this.venuesService.archive(partner.partnerId, id);
  }
}
