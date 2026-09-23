import { Controller, Get, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard.js';
import { MeResponseDto } from './dto/me-response.dto.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({
    description: "Returns the authenticated user's Classista profile",
    type: MeResponseDto,
  })
  me(@Req() request: Request): MeResponseDto {
    if (!request.user) {
      throw new UnauthorizedException();
    }

    return request.user;
  }
}
