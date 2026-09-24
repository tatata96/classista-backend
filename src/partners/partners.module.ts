import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../lib/database/prisma.module.js';
import { PartnersController } from './partners.controller.js';
import { PartnersService } from './partners.service.js';

@Module({
  // AuthModule: needed by SupabaseAuthGuard, which Nest builds inside this module.
  // PrismaModule: needed by PartnerAccessGuard and PartnersService.
  imports: [AuthModule, PrismaModule],
  controllers: [PartnersController],
  providers: [PartnersService],
})
export class PartnersModule {}
