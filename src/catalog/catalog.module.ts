import { Module } from '@nestjs/common';
import { PrismaModule } from '../lib/database/prisma.module.js';
import { CatalogClassesService } from './catalog-classes.service.js';

// What visitors can browse without an account (spec 0004). Organised around that
// audience rather than one database table, so nothing here uses a guard.
@Module({
  imports: [PrismaModule],
  providers: [CatalogClassesService],
})
export class CatalogModule {}
