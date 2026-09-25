import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../lib/database/prisma.service.js';
import { PartnerAccessGuard } from './partner-access.guard.js';

const PARTNER_A = '11111111-1111-4111-8111-111111111111';
const PARTNER_B = '22222222-2222-4222-8222-222222222222';
const PARTNER_INACTIVE = '33333333-3333-4333-8333-333333333333';
const PARTNER_MISSING = '44444444-4444-4444-8444-444444444444';

const ALICE = { id: 'user-alice', name: 'Alice', email: null, role: 'CUSTOMER' as const };

type Membership = {
  userId: string;
  partnerId: string;
  role: 'OWNER' | 'STAFF';
  status: 'ACTIVE' | 'INACTIVE';
};

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('PartnerAccessGuard', () => {
  // A tiny fake "table": findUnique behaves like the real unique-key lookup.
  let memberships: Membership[];
  const prismaMock = {
    partnerMembership: {
      findUnique: vi.fn(
        async ({ where }: { where: { userId: string } }) => {
          const row = memberships.find((m) => m.userId === where.userId);
          return row
            ? { partnerId: row.partnerId, role: row.role, partner: { status: row.status } }
            : null;
        },
      ),
    },
  };

  let guard: PartnerAccessGuard;

  beforeEach(async () => {
    memberships = [];
    prismaMock.partnerMembership.findUnique.mockClear();

    const module = await Test.createTestingModule({
      providers: [PartnerAccessGuard, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    guard = module.get(PartnerAccessGuard);
  });

  function requestFor(partnerId: string, extra: Record<string, unknown> = {}) {
    return { user: ALICE, params: { partnerId }, ...extra } as Record<string, unknown> & {
      partnerContext?: unknown;
    };
  }

  it('rejects with 401 when no user is on the request (SupabaseAuthGuard did not run)', async () => {
    const request = { params: { partnerId: PARTNER_A } };

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(UnauthorizedException);
    expect(prismaMock.partnerMembership.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a CUSTOMER with no memberships', async () => {
    await expect(guard.canActivate(contextFor(requestFor(PARTNER_A)))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lets an OWNER in and sets the verified partner context', async () => {
    memberships.push({ userId: ALICE.id, partnerId: PARTNER_A, role: 'OWNER', status: 'ACTIVE' });
    const request = requestFor(PARTNER_A);

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.partnerContext).toEqual({ partnerId: PARTNER_A, membershipRole: 'OWNER' });
  });

  it('gives STAFF the same access as OWNER', async () => {
    memberships.push({ userId: ALICE.id, partnerId: PARTNER_A, role: 'STAFF', status: 'ACTIVE' });
    const request = requestFor(PARTNER_A);

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.partnerContext).toEqual({ partnerId: PARTNER_A, membershipRole: 'STAFF' });
  });

  it('lets several users belong to the same partner, each with their own role', async () => {
    memberships.push(
      { userId: ALICE.id, partnerId: PARTNER_A, role: 'OWNER', status: 'ACTIVE' },
      { userId: 'user-bob', partnerId: PARTNER_A, role: 'STAFF', status: 'ACTIVE' },
    );
    const aliceRequest = requestFor(PARTNER_A);
    const bobRequest = { ...requestFor(PARTNER_A), user: { ...ALICE, id: 'user-bob' } };

    await expect(guard.canActivate(contextFor(aliceRequest))).resolves.toBe(true);
    await expect(guard.canActivate(contextFor(bobRequest))).resolves.toBe(true);
    expect(aliceRequest.partnerContext).toEqual({ partnerId: PARTNER_A, membershipRole: 'OWNER' });
    expect(bobRequest.partnerContext).toEqual({ partnerId: PARTNER_A, membershipRole: 'STAFF' });
  });

  it('rejects a member of partner A who asks for partner B, and sets no context', async () => {
    memberships.push({ userId: ALICE.id, partnerId: PARTNER_A, role: 'OWNER', status: 'ACTIVE' });
    const request = requestFor(PARTNER_B);

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(ForbiddenException);
    expect(request.partnerContext).toBeUndefined();
  });

  it('ignores a partnerId in the body or query: only the route param is checked', async () => {
    memberships.push({ userId: ALICE.id, partnerId: PARTNER_A, role: 'OWNER', status: 'ACTIVE' });
    // Route says B (no membership); body and query claim A (has membership).
    const request = requestFor(PARTNER_B, {
      body: { partnerId: PARTNER_A },
      query: { partnerId: PARTNER_A },
      headers: { 'x-partner-id': PARTNER_A },
    });

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(ForbiddenException);
    expect(prismaMock.partnerMembership.findUnique).toHaveBeenCalledTimes(1);
    expect(prismaMock.partnerMembership.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: ALICE.id },
      }),
    );
  });

  it('rejects a member of an INACTIVE partner with a specific message', async () => {
    memberships.push({
      userId: ALICE.id,
      partnerId: PARTNER_INACTIVE,
      role: 'OWNER',
      status: 'INACTIVE',
    });

    const result = guard.canActivate(contextFor(requestFor(PARTNER_INACTIVE)));

    await expect(result).rejects.toThrow(ForbiddenException);
    await expect(result).rejects.toThrow('This partner is inactive');
  });

  it('gives a missing partner the same 403 as a non-member, so ids cannot be probed', async () => {
    memberships.push({ userId: ALICE.id, partnerId: PARTNER_A, role: 'OWNER', status: 'ACTIVE' });

    const missing = guard.canActivate(contextFor(requestFor(PARTNER_MISSING)));
    const notMember = guard.canActivate(contextFor(requestFor(PARTNER_B)));

    await expect(missing).rejects.toThrow('You do not have access to this partner');
    await expect(notMember).rejects.toThrow('You do not have access to this partner');
  });

  it('rejects a malformed partner id with 403, without querying the database', async () => {
    await expect(guard.canActivate(contextFor(requestFor('not-a-uuid')))).rejects.toThrow(
      ForbiddenException,
    );
    expect(prismaMock.partnerMembership.findUnique).not.toHaveBeenCalled();
  });

  it("does not let one user's membership grant access to another user", async () => {
    memberships.push({ userId: 'user-bob', partnerId: PARTNER_A, role: 'OWNER', status: 'ACTIVE' });

    await expect(guard.canActivate(contextFor(requestFor(PARTNER_A)))).rejects.toThrow(
      ForbiddenException,
    );
  });
});
