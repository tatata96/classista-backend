import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './lib/database/prisma.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { validateEnv } from './config/env.validation.js';
import { AuthModule } from './auth/auth.module.js';
import { PartnersModule } from './partners/partners.module.js';
import { VenuesModule } from './venues/venues.module.js';
import { ClassTypesModule } from './class-types/class-types.module.js';
import { ClassPlansModule } from './class-plans/class-plans.module.js';
import { ClassSessionsModule } from './class-sessions/class-sessions.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    // Turns on @Cron() jobs, used by the class plan session generation.
    ScheduleModule.forRoot(),
    PrismaModule,
    CategoriesModule,
    AuthModule,
    PartnersModule,
    VenuesModule,
    ClassTypesModule,
    ClassPlansModule,
    ClassSessionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
