import { Module } from '@nestjs/common';
import { SupabaseAuthService } from './supabase-auth.service.js';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard.js';

@Module({
  providers: [SupabaseAuthService, SupabaseAuthGuard],
  exports: [SupabaseAuthService, SupabaseAuthGuard],
})
export class AuthModule {}
