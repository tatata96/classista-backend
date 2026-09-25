import { Test } from '@nestjs/testing';
import { Controller, Get, Logger, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import { PartnersModule } from '../src/partners/partners.module.js';
import { PrismaService } from '../src/lib/database/prisma.service.js';
import { SupabaseAuthService } from '../src/auth/supabase-auth.service.js';
import { CurrentPartner } from '../src/partners/decorators/current-partner.decorator.js';
import type { PartnerContext } from '../src/partners/types/partner-context.js';

/**
 * Integration test: the REAL SupabaseAuthGuard, AuthService, PartnerAccessGuard,
 * controller and service run together through real HTTP. Only the two outside
 * systems are faked: Supabase token verification and the database.
 */

const YOGA_LOFT = '11111111-1111-4111-8111-111111111111';
const PILATES_CO = '22222222-2222-4222-8222-222222222222';
const CLOSED_STUDIO = '33333333-3333-4333-8333-333333333333';
const UNKNOWN_PARTNER = '99999999-9999-4999-8999-999999999999';

// Fake tokens -> Supabase ids. Anything else fails verification.
const TOKENS: Record<string, string> = {
  'alice-token': 'supabase-alice', // OWNER at Yoga Loft only
  'bob-token': 'supabase-bob', // STAFF at Pilates Co only
  'carol-token': 'supabase-carol', // STAFF at Yoga Loft (a second member of it)
  'dave-token': 'supabase-dave', // OWNER at a closed (inactive) studio
  'erin-token': 'supabase-erin', // no memberships
};

describe('GET /partners/:partnerId (integration)', () => {
  let app: INestApplication;
  const users: { id: string; supabaseId: string; name: string; email: null; role: 'CUSTOMER' }[] =
    [];
  const memberships: { userId: string; partnerId: string; role: 'OWNER' | 'STAFF' }[] = [];
  const partners = [
    { id: YOGA_LOFT, name: 'Yoga Loft', description: 'Calm classes', status: 'ACTIVE' },
    { id: PILATES_CO, name: 'Pilates Co', description: null, status: 'ACTIVE' },
    { id: CLOSED_STUDIO, name: 'Closed Studio', description: null, status: 'INACTIVE' },
  ];

  // In-memory stand-in for the three Prisma calls the code under test makes.
  const prismaFake = {
    user: {
      // Mirrors AuthService.findOrCreateUser: find by supabaseId or create a CUSTOMER.
      upsert: async ({ where, create }: { where: { supabaseId: string }; create: { name: string } }) => {
        let user = users.find((u) => u.supabaseId === where.supabaseId);
        if (!user) {
          user = {
            id: `user-${where.supabaseId}`,
            supabaseId: where.supabaseId,
            name: create.name,
            email: null,
            role: 'CUSTOMER',
          };
          users.push(user);
        }
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    },
    partnerMembership: {
      findUnique: async ({ where }: { where: { userId: string } }) => {
        const row = memberships.find((m) => m.userId === where.userId);
        const partner = partners.find((p) => p.id === row?.partnerId);
        return row && partner
          ? { partnerId: row.partnerId, role: row.role, partner: { status: partner.status } }
          : null;
      },
    },
    partner: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        partners.find((p) => p.id === where.id) ?? null,
    },
  };

  beforeEach(async () => {
    users.length = 0;
    memberships.length = 0;
    for (const [supabaseId, name] of [
      ['supabase-alice', 'alice'],
      ['supabase-bob', 'bob'],
      ['supabase-carol', 'carol'],
      ['supabase-dave', 'dave'],
    ]) {
      users.push({ id: `user-${supabaseId}`, supabaseId, name, email: null, role: 'CUSTOMER' });
    }
    memberships.push(
      { userId: 'user-supabase-alice', partnerId: YOGA_LOFT, role: 'OWNER' },
      { userId: 'user-supabase-bob', partnerId: PILATES_CO, role: 'STAFF' },
      { userId: 'user-supabase-carol', partnerId: YOGA_LOFT, role: 'STAFF' },
      { userId: 'user-supabase-dave', partnerId: CLOSED_STUDIO, role: 'OWNER' },
    );

    const moduleRef = await Test.createTestingModule({ imports: [PartnersModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaFake)
      .overrideProvider(SupabaseAuthService)
      .useValue({
        verifyAccessToken: async (token: string) => {
          const sub = TOKENS[token];
          if (!sub) throw new Error('invalid token');
          return { sub };
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const get = (partnerId: string, token?: string) => {
    const req = request(app.getHttpServer()).get(`/partners/${partnerId}`);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  describe('authentication (SupabaseAuthGuard)', () => {
    it('returns 401 with no token', async () => {
      await get(YOGA_LOFT).expect(401);
    });

    it('returns 401 with an invalid token', async () => {
      await get(YOGA_LOFT, 'garbage').expect(401);
    });
  });

  describe('authorization (PartnerAccessGuard)', () => {
    it('lets an OWNER read their own partner', async () => {
      const res = await get(YOGA_LOFT, 'alice-token').expect(200);

      expect(res.body).toEqual({
        id: YOGA_LOFT,
        name: 'Yoga Loft',
        description: 'Calm classes',
        status: 'ACTIVE',
      });
    });

    it('lets STAFF read their own partner', async () => {
      await get(PILATES_CO, 'bob-token').expect(200);
    });

    it('lets several members of the same partner read it', async () => {
      const owner = await get(YOGA_LOFT, 'alice-token').expect(200);
      const staff = await get(YOGA_LOFT, 'carol-token').expect(200);

      expect(owner.body.name).toBe('Yoga Loft');
      expect(staff.body.name).toBe('Yoga Loft');
    });

    it('denies a member of one partner access to another partner (cross-partner)', async () => {
      const res = await get(PILATES_CO, 'alice-token').expect(403);

      expect(res.body).toMatchObject({
        statusCode: 403,
        message: 'You do not have access to this partner',
      });
      // No partner data leaks in the error.
      expect(JSON.stringify(res.body)).not.toContain('Pilates Co');
    });

    it('denies the reverse direction too', async () => {
      await get(YOGA_LOFT, 'bob-token').expect(403);
    });

    it('denies an authenticated user with no memberships, and registration granted none', async () => {
      // Erin has no Prisma user yet: the first request creates her as a CUSTOMER.
      await get(YOGA_LOFT, 'erin-token').expect(403);

      const erin = users.find((u) => u.supabaseId === 'supabase-erin');
      expect(erin?.role).toBe('CUSTOMER');
      expect(memberships.some((m) => m.userId === erin?.id)).toBe(false);
    });

    it('returns 403 for an inactive partner, even for its owner', async () => {
      const res = await get(CLOSED_STUDIO, 'dave-token').expect(403);

      expect(res.body.message).toBe('This partner is inactive');
    });

    it('returns the same 403 for a partner that does not exist as for a non-member', async () => {
      const missing = await get(UNKNOWN_PARTNER, 'alice-token').expect(403);
      const notMember = await get(PILATES_CO, 'alice-token').expect(403);

      expect(missing.body.message).toBe(notMember.body.message);
    });

    it('returns 403 for a malformed partner id instead of a 500', async () => {
      await get('not-a-uuid', 'alice-token').expect(403);
    });
  });
});

describe('@CurrentPartner() on an unguarded route (developer mistake)', () => {
  // A deliberately misconfigured route: uses the decorator but no PartnerAccessGuard.
  @Controller('misconfigured')
  class MisconfiguredController {
    @Get()
    find(@CurrentPartner() partner: PartnerContext) {
      return partner;
    }
  }

  it('returns only the generic 500 to the client and logs the real cause server-side', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MisconfiguredController],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    // The filter logs unexpected errors through Nest's Logger; keep test output quiet.
    const logSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const res = await request(app.getHttpServer()).get('/misconfigured').expect(500);

    expect(res.body.message).toBe('Something went wrong. Please try again later.');
    expect(JSON.stringify(res.body)).not.toContain('CurrentPartner');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('@CurrentPartner()'));

    logSpy.mockRestore();
    await app.close();
  });
});
