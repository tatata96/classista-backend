import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { Request } from 'express';
import { PrismaService } from '../../lib/database/prisma.service.js';
import { PartnerStatus } from '../../generated/prisma/enums.js';

// One message for "not a member", "partner does not exist" and "malformed id",
// so a caller cannot use the API to discover which partner ids exist.
const NO_ACCESS_MESSAGE = 'You do not have access to this partner';

/**
 * Authorization guard: may the authenticated user act for the partner named in
 * the route (`:partnerId`)? Must run AFTER SupabaseAuthGuard:
 *
 *   @UseGuards(SupabaseAuthGuard, PartnerAccessGuard)
 *
 * The route's partnerId is only a claim. It becomes trusted only once a
 * PartnerMembership row for (this user, this partner) exists in the database.
 */
@Injectable()
export class PartnerAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Safety net: only happens if someone forgot SupabaseAuthGuard.
    if (!request.user) {
      throw new UnauthorizedException();
    }

    const partnerId: unknown = request.params.partnerId;

    // Checking the format first stops Prisma throwing (-> 500) on ids like "abc".
    if (typeof partnerId !== 'string' || !isUUID(partnerId)) {
      throw new ForbiddenException(NO_ACCESS_MESSAGE);
    }

    // A user has at most one membership (userId is unique), so look it up by
    // user and then check it is for the partner named in the URL.
    const membership = await this.prisma.partnerMembership.findUnique({
      where: { userId: request.user.id },
      select: {
        partnerId: true,
        role: true,
        partner: { select: { status: true } },
      },
    });

    if (!membership || membership.partnerId !== partnerId) {
      throw new ForbiddenException(NO_ACCESS_MESSAGE);
    }

    // The user is a member, so they already know the partner exists;
    // a specific message is safe and helps the dashboard explain what happened.
    if (membership.partner.status !== PartnerStatus.ACTIVE) {
      throw new ForbiddenException('This partner is inactive');
    }

    // Use the id stored in the database, not the raw string from the URL.
    request.partnerContext = {
      partnerId: membership.partnerId,
      membershipRole: membership.role,
    };

    return true;
  }
}
