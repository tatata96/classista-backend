import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../lib/database/prisma.module.js';
import { ClassTypesController } from './class-types.controller.js';
import { ClassTypesService } from './class-types.service.js';

@Module({
  // AuthModule: needed by SupabaseAuthGuard, which Nest builds inside this module.
  // PrismaModule: needed by PartnerAccessGuard and ClassTypesService.
  imports: [AuthModule, PrismaModule],
  controllers: [ClassTypesController],
  providers: [ClassTypesService],
})
export class ClassTypesModule {}
