import { createParamDecorator, ExecutionContext } from '@nestjs/common';
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
    // A plain Error (not an HttpException) on purpose: AllExceptionsFilter logs
    // it server-side and sends the client only a generic 500, so this
    // implementation detail never leaks.
    if (!request.partnerContext) {
      throw new Error('@CurrentPartner() used on a route without PartnerAccessGuard');
    }

    return request.partnerContext;
  },
);
