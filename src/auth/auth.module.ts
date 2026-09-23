import { Module } from '@nestjs/common';
import { SupabaseAuthService } from './supabase-auth.service.js';

@Module({
  providers: [SupabaseAuthService],
  exports: [SupabaseAuthService],
})
export class AuthModule {}
