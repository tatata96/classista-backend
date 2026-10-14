import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard.js';
import { CurrentPartner } from '../partners/decorators/current-partner.decorator.js';
import { PartnerAccessGuard } from '../partners/guards/partner-access.guard.js';
import type { PartnerContext } from '../partners/types/partner-context.js';
import { ClassPlansService } from './class-plans.service.js';
import { ClassPlanResponseDto } from './dto/class-plan-response.dto.js';
import { CreateClassPlanDto } from './dto/create-class-plan.dto.js';

// "/partner/..." has no :partnerId: PartnerAccessGuard resolves the partner
// from the authenticated user's own membership. OWNER and STAFF are equal.
@ApiTags('Partner class plans')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@ApiForbiddenResponse({
  description: 'Not a partner member, or the partner is inactive',
})
@UseGuards(SupabaseAuthGuard, PartnerAccessGuard)
@Controller('partner/class-plans')
export class ClassPlansController {
  constructor(private readonly classPlansService: ClassPlansService) {}

  @Get()
  @ApiOkResponse({
    description: "Lists the partner's class plans, newest start date first",
    type: [ClassPlanResponseDto],
  })
  findAll(
    @CurrentPartner() partner: PartnerContext,
  ): Promise<ClassPlanResponseDto[]> {
    return this.classPlansService.findAll(partner.partnerId);
  }

  @Post()
  @ApiCreatedResponse({
    description:
      'Creates an active class plan and generates its sessions (one session for a one-time plan, the next 30 days for a recurring plan)',
    type: ClassPlanResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Invalid body; the Class Type, venue, or instructor is unknown, archived, or inactive; or a one-time class does not start in the future',
  })
  create(
    @CurrentPartner() partner: PartnerContext,
    @Body() dto: CreateClassPlanDto,
  ): Promise<ClassPlanResponseDto> {
    return this.classPlansService.create(partner.partnerId, dto);
  }
}
