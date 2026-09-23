import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { JWTPayload } from 'jose';
import { PrismaService } from '../lib/database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';

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

  private resolveName(payload: JWTPayload, email: string | null): string {
    const metadata = payload.user_metadata as Record<string, unknown> | undefined;
    const fullName = metadata?.full_name;

    if (typeof fullName === 'string' && fullName.trim().length > 0) {
      return fullName;
    }

    return email?.split('@')[0] ?? 'New user';
  }
}
