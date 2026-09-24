import { Controller, Get, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard.js';
import { MeResponseDto } from './dto/me-response.dto.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({
    description: "Returns the authenticated user's Classista profile and partner",
    type: MeResponseDto,
  })
  async me(@Req() request: Request): Promise<MeResponseDto> {
    if (!request.user) {
      throw new UnauthorizedException();
    }

    const partner = await this.authService.getPartner(request.user.id);

    return { ...request.user, partner };
  }
}
