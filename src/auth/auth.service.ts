import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { JWTPayload } from 'jose';
import { PrismaService } from '../lib/database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { MePartnerDto } from './dto/me-partner.dto.js';

const AUTHENTICATED_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

export type AuthenticatedUser = Prisma.UserGetPayload<{
  select: typeof AUTHENTICATED_USER_SELECT;
}>;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateUser(payload: JWTPayload): Promise<AuthenticatedUser> {
    const supabaseId = payload.sub;

    if (!supabaseId) {
      throw new UnauthorizedException('Token has no subject');
    }

    const email = typeof payload.email === 'string' ? payload.email : null;

    try {
      return await this.prisma.user.upsert({
        where: { supabaseId },
        update: {},
        create: { supabaseId, email, name: this.resolveName(payload, email) },
        select: AUTHENTICATED_USER_SELECT,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        (error.meta?.target as string[] | undefined)?.includes('email')
      ) {
        throw new ConflictException(
          'An account with this email already exists. Ask an admin to link it to your login.',
        );
      }
      throw error;
    }
  }

  /**
   * The partner this user belongs to, for dashboard display only (null if none).
   * This is NOT authorization: PartnerAccessGuard re-checks the database on
   * every partner request, whatever the dashboard shows or sends.
   * Returned even when the partner is INACTIVE, so the dashboard can show
   * that state (partner endpoints still refuse it with 403).
   *
   * The MVP rule is one partner per user, but the schema does not enforce it
   * yet (a separate PR will). Until then, if a user has several memberships,
   * the OLDEST (by createdAt) is returned so the result is deterministic.
   */
  async getPartner(userId: string): Promise<MePartnerDto | null> {
    const membership = await this.prisma.partnerMembership.findFirst({
      where: { userId },
      select: { role: true, partner: { select: { id: true, name: true, status: true } } },
      orderBy: { createdAt: 'asc' },
    });

    if (!membership) {
      return null;
    }

    return {
      id: membership.partner.id,
      name: membership.partner.name,
      status: membership.partner.status,
      role: membership.role,
    };
  }

  private resolveName(payload: JWTPayload, email: string | null): string {
    const metadata = payload.user_metadata as Record<string, unknown> | undefined;
    const fullName = metadata?.full_name;

    if (typeof fullName === 'string' && fullName.trim().length > 0) {
      return fullName;
    }

    return email?.split('@')[0] ?? 'New user';
  }
}
