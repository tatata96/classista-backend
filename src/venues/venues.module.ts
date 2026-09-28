import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../lib/database/prisma.module.js';
import { VenuesController } from './venues.controller.js';
import { VenuesService } from './venues.service.js';

@Module({
  // AuthModule: needed by SupabaseAuthGuard, which Nest builds inside this module.
  // PrismaModule: needed by PartnerAccessGuard and VenuesService.
  imports: [AuthModule, PrismaModule],
  controllers: [VenuesController],
  providers: [VenuesService],
})
export class VenuesModule {}
