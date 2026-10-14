import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../lib/database/prisma.module.js';
import { ClassSessionsController } from './class-sessions.controller.js';
import { ClassSessionsService } from './class-sessions.service.js';

@Module({
  // AuthModule: needed by SupabaseAuthGuard, which Nest builds inside this module.
  // PrismaModule: needed by PartnerAccessGuard and ClassSessionsService.
  imports: [AuthModule, PrismaModule],
  controllers: [ClassSessionsController],
  providers: [ClassSessionsService],
})
export class ClassSessionsModule {}
