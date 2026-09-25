import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../lib/database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';

describe('AuthService', () => {
  const prismaMock = {
    user: {
      upsert: vi.fn(),
    },
    partnerMembership: {
      findUnique: vi.fn(),
    },
  };

  let service: AuthService;

  beforeEach(async () => {
    prismaMock.user.upsert.mockReset();
    prismaMock.partnerMembership.findUnique.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects a token with no subject claim', async () => {
    await expect(service.findOrCreateUser({})).rejects.toThrow(UnauthorizedException);
    expect(prismaMock.user.upsert).not.toHaveBeenCalled();
  });

  it('resolves the Classista user keyed on the Supabase subject claim (covers AC-4, AC-6)', async () => {
    const resolvedUser = {
      id: 'u1',
      name: 'Jane',
      email: 'jane@example.com',
      role: 'CUSTOMER',
    };
    prismaMock.user.upsert.mockResolvedValue(resolvedUser);

    const result = await service.findOrCreateUser({
      sub: 'supabase-1',
      email: 'jane@example.com',
    });

    expect(result).toEqual(resolvedUser);
    expect(prismaMock.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { supabaseId: 'supabase-1' },
        update: {},
      }),
    );
  });

  it('upserts by the same key on every call, so repeated logins never create a duplicate (covers AC-6)', async () => {
    prismaMock.user.upsert.mockResolvedValue({ id: 'u1' });

    await service.findOrCreateUser({ sub: 'supabase-1', email: 'jane@example.com' });
    await service.findOrCreateUser({ sub: 'supabase-1', email: 'jane@example.com' });

    expect(prismaMock.user.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { supabaseId: 'supabase-1' } }),
    );
    expect(prismaMock.user.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { supabaseId: 'supabase-1' } }),
    );
  });

  it('never sets role or attaches a membership on creation, so nobody can self grant access (covers AC-5)', async () => {
    prismaMock.user.upsert.mockResolvedValue({ id: 'u1' });

    await service.findOrCreateUser({ sub: 'supabase-1' });

    const call = prismaMock.user.upsert.mock.calls[0][0];
    expect(call.create).not.toHaveProperty('role');
    expect(call.create).not.toHaveProperty('memberships');
  });

  it('only selects the safe profile fields back from the database (covers AC-7)', async () => {
    prismaMock.user.upsert.mockResolvedValue({ id: 'u1' });

    await service.findOrCreateUser({ sub: 'supabase-1' });

    expect(prismaMock.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, name: true, email: true, role: true },
      }),
    );
  });

  it('uses the Supabase user_metadata full_name when the frontend sent one', async () => {
    prismaMock.user.upsert.mockResolvedValue({ id: 'u1' });

    await service.findOrCreateUser({
      sub: 'supabase-1',
      email: 'jane@example.com',
      user_metadata: { full_name: 'Jane Doe' },
    });

    expect(prismaMock.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ name: 'Jane Doe' }) }),
    );
  });

  it('falls back to the email local part when no name metadata is sent', async () => {
    prismaMock.user.upsert.mockResolvedValue({ id: 'u1' });

    await service.findOrCreateUser({ sub: 'supabase-1', email: 'jane@example.com' });

    expect(prismaMock.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ name: 'jane' }) }),
    );
  });

  it('falls back to "New user" when there is no name metadata and no email', async () => {
    prismaMock.user.upsert.mockResolvedValue({ id: 'u1' });

    await service.findOrCreateUser({ sub: 'supabase-1' });

    expect(prismaMock.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ name: 'New user' }) }),
    );
  });

  it('rejects with a 409 conflict when the email already belongs to another user, without linking accounts (covers AC-9)', async () => {
    prismaMock.user.upsert.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`email`)',
        { code: 'P2002', clientVersion: '7.10.0', meta: { target: ['email'] } },
      ),
    );

    await expect(
      service.findOrCreateUser({ sub: 'supabase-2', email: 'jane@example.com' }),
    ).rejects.toThrow(ConflictException);
  });

  it('does not treat a unique constraint violation on a different field as an email collision', async () => {
    const dbError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`phone`)',
      { code: 'P2002', clientVersion: '7.10.0', meta: { target: ['phone'] } },
    );
    prismaMock.user.upsert.mockRejectedValue(dbError);

    await expect(service.findOrCreateUser({ sub: 'supabase-3' })).rejects.toBe(dbError);
  });

  it('rethrows an unrelated database error unchanged', async () => {
    const dbError = new Error('connection reset');
    prismaMock.user.upsert.mockRejectedValue(dbError);

    await expect(service.findOrCreateUser({ sub: 'supabase-4' })).rejects.toBe(dbError);
  });
  describe('getPartner', () => {
    it('returns null for a user with no membership', async () => {
      prismaMock.partnerMembership.findUnique.mockResolvedValue(null);

      await expect(service.getPartner('u1')).resolves.toBeNull();
    });

    it('flattens the membership into the partner shape the dashboard needs', async () => {
      prismaMock.partnerMembership.findUnique.mockResolvedValue({
        role: 'OWNER',
        partner: { id: 'p1', name: 'Core Studio', status: 'ACTIVE' },
      });

      await expect(service.getPartner('u1')).resolves.toEqual({
        id: 'p1',
        name: 'Core Studio',
        status: 'ACTIVE',
        role: 'OWNER',
      });
    });

    it('still returns an INACTIVE partner, with its status, so the dashboard can handle it', async () => {
      prismaMock.partnerMembership.findUnique.mockResolvedValue({
        role: 'STAFF',
        partner: { id: 'p1', name: 'Core Studio', status: 'INACTIVE' },
      });

      await expect(service.getPartner('u1')).resolves.toEqual({
        id: 'p1',
        name: 'Core Studio',
        status: 'INACTIVE',
        role: 'STAFF',
      });
    });

    it("only queries the given user's membership and selects nothing sensitive", async () => {
      prismaMock.partnerMembership.findUnique.mockResolvedValue(null);

      await service.getPartner('u1');

      expect(prismaMock.partnerMembership.findUnique).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        select: { role: true, partner: { select: { id: true, name: true, status: true } } },
      });
    });
  });
});
