import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SupabaseAuthService } from '../supabase-auth.service.js';
import { AuthService } from '../auth.service.js';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly supabaseAuth: SupabaseAuthService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload;
    try {
      payload = await this.supabaseAuth.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    request.user = await this.authService.findOrCreateUser(payload);

    return true;
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
