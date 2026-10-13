import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard.js';
import { CurrentPartner } from '../partners/decorators/current-partner.decorator.js';
import { PartnerAccessGuard } from '../partners/guards/partner-access.guard.js';
import type { PartnerContext } from '../partners/types/partner-context.js';
import { ClassTypesService } from './class-types.service.js';
import { ClassTypeResponseDto } from './dto/class-type-response.dto.js';
import { FindClassTypesQueryDto } from './dto/find-class-types-query.dto.js';

// "/partner/..." has no :partnerId: PartnerAccessGuard resolves the partner
// from the authenticated user's own membership. OWNER and STAFF are equal.
@ApiTags('Partner class types')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@ApiForbiddenResponse({
  description: 'Not a partner member, or the partner is inactive',
})
@UseGuards(SupabaseAuthGuard, PartnerAccessGuard)
@Controller('partner/class-types')
export class ClassTypesController {
  constructor(private readonly classTypesService: ClassTypesService) {}

  @Get()
  @ApiOkResponse({
    description:
      "Lists the partner's class types: active by default, archived with isActive=false",
    type: [ClassTypeResponseDto],
  })
  @ApiBadRequestResponse({ description: 'isActive is not true or false' })
  findAll(
    @CurrentPartner() partner: PartnerContext,
    @Query() query: FindClassTypesQueryDto,
  ): Promise<ClassTypeResponseDto[]> {
    return this.classTypesService.findAll(partner.partnerId, query.isActive);
  }
}
