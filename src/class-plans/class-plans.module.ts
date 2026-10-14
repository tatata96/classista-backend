import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../lib/database/prisma.module.js';
import { ClassPlansController } from './class-plans.controller.js';
import { ClassPlansService } from './class-plans.service.js';
import { SessionGenerationScheduler } from './session-generation/session-generation.scheduler.js';
import { SessionGenerationService } from './session-generation/session-generation.service.js';

@Module({
  // AuthModule: needed by SupabaseAuthGuard, which Nest builds inside this module.
  // PrismaModule: needed by PartnerAccessGuard and both services.
  imports: [AuthModule, PrismaModule],
  controllers: [ClassPlansController],
  providers: [
    ClassPlansService,
    SessionGenerationService,
    SessionGenerationScheduler,
  ],
})
export class ClassPlansModule {}
