import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { PartnerContext } from '../types/partner-context.js';

/**
 * Injects the verified partner context into a controller method:
 *
 *   @Get() find(@CurrentPartner() partner: PartnerContext) { ... }
 *
 * Only works on routes protected by PartnerAccessGuard.
 */
export const CurrentPartner = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PartnerContext => {
    const request = context.switchToHttp().getRequest<Request>();

    // Reaching this means a developer forgot the guard: a server bug, not a
    // client error. Failing loudly beats silently running with no partner.
    if (!request.partnerContext) {
      throw new InternalServerErrorException(
        '@CurrentPartner() used on a route without PartnerAccessGuard',
      );
    }

    return request.partnerContext;
  },
);
