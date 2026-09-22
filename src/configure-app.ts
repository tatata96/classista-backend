import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

/**
 * Applies the global request pipeline (CORS, validation, error shape).
 * Shared between main.ts and e2e tests so tests exercise the exact same
 * pipeline as production instead of a re-declared copy that can drift.
 */
export function configureApp(app: INestApplication): void {
  const configService = app.get(ConfigService);

  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN'),
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
}
