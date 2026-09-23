import { Module } from '@nestjs/common';
import { PrismaModule } from '../lib/database/prisma.module.js';
import { SupabaseAuthService } from './supabase-auth.service.js';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';

@Module({
  imports: [PrismaModule],
  providers: [SupabaseAuthService, SupabaseAuthGuard, AuthService],
  exports: [SupabaseAuthService, SupabaseAuthGuard],
  controllers: [AuthController],
})
export class AuthModule {}
