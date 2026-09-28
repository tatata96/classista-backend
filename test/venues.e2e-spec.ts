import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/lib/database/prisma.service.js';
import { SupabaseAuthService } from '../src/auth/supabase-auth.service.js';
import { VenuesModule } from '../src/venues/venues.module.js';

/**
 * Integration test: the REAL guards, controller, service, DTO validation and
 * global pipeline (configureApp) run together through real HTTP. Only the two
 * outside systems are faked: Supabase token verification and the database.
 */

const YOGA_LOFT = '11111111-1111-4111-8111-111111111111';
const PILATES_CO = '22222222-2222-4222-8222-222222222222';
const CLOSED_STUDIO = '33333333-3333-4333-8333-333333333333';

const YOGA_ACTIVE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const YOGA_ARCHIVED = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PILATES_VENUE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const UNKNOWN_VENUE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const TOKENS: Record<string, string> = {
  'alice-token': 'supabase-alice', // OWNER at Yoga Loft
  'carol-token': 'supabase-carol', // STAFF at Yoga Loft
  'bob-token': 'supabase-bob', // STAFF at Pilates Co
  'dave-token': 'supabase-dave', // OWNER at an inactive partner
  'erin-token': 'supabase-erin', // no membership
};

interface VenueRow {
  id: string;
  partnerId: string;
  name: string;
  status: 'ACTIVE' | 'ARCHIVED';
  addressLine: string;
  district: string;
  city: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  timezone: string;
  amenityIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

const venueRow = (overrides: Partial<VenueRow>): VenueRow => ({
  id: 'x',
  partnerId: YOGA_LOFT,
  name: 'Venue',
  status: 'ACTIVE',
  addressLine: '1 Main St',
  district: 'Kadıköy',
  city: 'Istanbul',
  postalCode: null,
  latitude: null,
  longitude: null,
  phone: null,
  timezone: 'Europe/Istanbul',
  amenityIds: [],
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const validVenue = {
  name: 'Moda Studio',
  addressLine: 'Moda Caddesi 5',
  district: 'Kadıköy',
  city: 'Istanbul',
  timezone: 'Europe/Istanbul',
};

describe('Partner venues (integration)', () => {
  let app: INestApplication;
  let venues: VenueRow[];
  const users: { id: string; supabaseId: string }[] = [];
  const memberships = [
    { userId: 'user-supabase-alice', partnerId: YOGA_LOFT, role: 'OWNER' },
    { userId: 'user-supabase-carol', partnerId: YOGA_LOFT, role: 'STAFF' },
    { userId: 'user-supabase-bob', partnerId: PILATES_CO, role: 'STAFF' },
    { userId: 'user-supabase-dave', partnerId: CLOSED_STUDIO, role: 'OWNER' },
  ];
  const partnerStatus: Record<string, string> = {
    [YOGA_LOFT]: 'ACTIVE',
    [PILATES_CO]: 'ACTIVE',
    [CLOSED_STUDIO]: 'INACTIVE',
  };

  // Keeps only the selected columns, like Prisma's `select`.
  const pick = (row: VenueRow, select?: Record<string, boolean>) =>
    select
      ? Object.fromEntries(
          Object.entries(select)
            .filter(([, on]) => on)
            .map(([k]) => [k, row[k as keyof VenueRow]]),
        )
      : row;

  const prismaFake = {
    user: {
      upsert: async ({ where }: { where: { supabaseId: string } }) => {
        const id = `user-${where.supabaseId}`;
        if (!users.some((u) => u.id === id))
          users.push({ id, supabaseId: where.supabaseId });
        return { id, name: id, email: null, role: 'CUSTOMER' };
      },
    },
    partnerMembership: {
      findUnique: async ({ where }: { where: { userId: string } }) => {
        const row = memberships.find((m) => m.userId === where.userId);
        return row
          ? {
              partnerId: row.partnerId,
              role: row.role,
              partner: { status: partnerStatus[row.partnerId] },
            }
          : null;
      },
    },
    venue: {
      findMany: async ({
        where,
        select,
      }: {
        where: { partnerId: string; status: string };
        select: Record<string, boolean>;
      }) =>
        venues
          .filter(
            (v) => v.partnerId === where.partnerId && v.status === where.status,
          )
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((v) => pick(v, select)),
      findFirst: async ({
        where,
        select,
      }: {
        where: { id: string; partnerId: string };
        select: Record<string, boolean>;
      }) => {
        const row = venues.find(
          (v) => v.id === where.id && v.partnerId === where.partnerId,
        );
        return row ? pick(row, select) : null;
      },
      create: async ({
        data,
        select,
      }: {
        data: Partial<VenueRow> & { partnerId: string };
        select: Record<string, boolean>;
      }) => {
        const row = venueRow({ id: `new-venue-${venues.length}`, ...data });
        venues.push(row);
        return pick(row, select);
      },
      update: async ({
        where,
        data,
        select,
      }: {
        where: { id: string };
        data: Partial<VenueRow>;
        select: Record<string, boolean>;
      }) => {
        const row = venues.find((v) => v.id === where.id)!;
        Object.assign(
          row,
          Object.fromEntries(
            Object.entries(data).filter(([, v]) => v !== undefined),
          ),
        );
        return pick(row, select);
      },
    },
  };

  beforeEach(async () => {
    users.length = 0;
    venues = [
      venueRow({
        id: YOGA_ACTIVE,
        partnerId: YOGA_LOFT,
        name: 'Yoga Loft Main',
      }),
      venueRow({
        id: YOGA_ARCHIVED,
        partnerId: YOGA_LOFT,
        name: 'Yoga Loft Old',
        status: 'ARCHIVED',
      }),
      venueRow({
        id: PILATES_VENUE,
        partnerId: PILATES_CO,
        name: 'Pilates Central',
      }),
    ];

    const moduleRef = await Test.createTestingModule({
      // ConfigModule: configureApp() reads CORS_ORIGIN through ConfigService.
      imports: [ConfigModule.forRoot({ isGlobal: true }), VenuesModule],
    })
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
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  describe('access control', () => {
    it('returns 401 without a token', async () => {
      await http().get('/partner/venues').expect(401);
    });

    it('returns 403 for a user with no partner membership', async () => {
      await http().get('/partner/venues').set(auth('erin-token')).expect(403);
    });

    it('returns 403 for a member of an inactive partner', async () => {
      await http()
        .post('/partner/venues')
        .set(auth('dave-token'))
        .send(validVenue)
        .expect(403);
    });
  });

  describe('GET /partner/venues', () => {
    it("lists the partner's ACTIVE venues", async () => {
      const res = await http()
        .get('/partner/venues')
        .set(auth('alice-token'))
        .expect(200);

      expect(res.body.map((v: { id: string }) => v.id)).toEqual([YOGA_ACTIVE]);
      expect(res.body[0]).not.toHaveProperty('partnerId');
    });

    it('does not return venues from another partner', async () => {
      const res = await http()
        .get('/partner/venues')
        .set(auth('alice-token'))
        .expect(200);

      expect(JSON.stringify(res.body)).not.toContain(PILATES_VENUE);
      const bob = await http()
        .get('/partner/venues')
        .set(auth('bob-token'))
        .expect(200);
      expect(bob.body.map((v: { id: string }) => v.id)).toEqual([
        PILATES_VENUE,
      ]);
    });

    it('does not return archived venues', async () => {
      const res = await http()
        .get('/partner/venues')
        .set(auth('alice-token'))
        .expect(200);

      expect(res.body.map((v: { id: string }) => v.id)).not.toContain(
        YOGA_ARCHIVED,
      );
    });

    it('gives STAFF the same view as OWNER', async () => {
      const res = await http()
        .get('/partner/venues')
        .set(auth('carol-token'))
        .expect(200);

      expect(res.body).toHaveLength(1);
    });
  });

  describe('POST /partner/venues', () => {
    it('creates an ACTIVE venue for the authenticated partner', async () => {
      const res = await http()
        .post('/partner/venues')
        .set(auth('alice-token'))
        .send({
          ...validVenue,
          phone: '+90 216 555 00 00',
          latitude: 40.99,
          longitude: 29.03,
          amenityIds: ['SHOWER', 'WIFI'],
        })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'Moda Studio',
        status: 'ACTIVE',
        amenityIds: ['SHOWER', 'WIFI'],
      });
      const stored = venues.find((v) => v.id === res.body.id);
      expect(stored?.partnerId).toBe(YOGA_LOFT);
    });

    it('lets STAFF create a venue', async () => {
      await http()
        .post('/partner/venues')
        .set(auth('bob-token'))
        .send(validVenue)
        .expect(201);

      expect(venues.at(-1)?.partnerId).toBe(PILATES_CO);
    });

    it('rejects a partnerId or status in the body (never client-controlled)', async () => {
      const withPartner = await http()
        .post('/partner/venues')
        .set(auth('alice-token'))
        .send({ ...validVenue, partnerId: PILATES_CO })
        .expect(400);
      const withStatus = await http()
        .post('/partner/venues')
        .set(auth('alice-token'))
        .send({ ...validVenue, status: 'ARCHIVED' })
        .expect(400);

      expect(withPartner.body.message).toContain(
        'property partnerId should not exist',
      );
      expect(withStatus.body.message).toContain(
        'property status should not exist',
      );
      expect(venues).toHaveLength(3);
    });

    it('rejects a body missing required fields', async () => {
      const res = await http()
        .post('/partner/venues')
        .set(auth('alice-token'))
        .send({ name: 'Only a name' })
        .expect(400);

      expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('addressLine'),
          expect.stringContaining('district'),
          expect.stringContaining('city'),
          expect.stringContaining('timezone'),
        ]),
      );
    });

    it('rejects an empty name and wrong types', async () => {
      await http()
        .post('/partner/venues')
        .set(auth('alice-token'))
        .send({ ...validVenue, name: '' })
        .expect(400);
      await http()
        .post('/partner/venues')
        .set(auth('alice-token'))
        .send({ ...validVenue, city: 42 })
        .expect(400);
    });

    it('rejects out-of-range coordinates', async () => {
      const lat = await http()
        .post('/partner/venues')
        .set(auth('alice-token'))
        .send({ ...validVenue, latitude: 91 })
        .expect(400);
      const lng = await http()
        .post('/partner/venues')
        .set(auth('alice-token'))
        .send({ ...validVenue, longitude: -181 })
        .expect(400);

      expect(lat.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('latitude')]),
      );
      expect(lng.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('longitude')]),
      );
    });

    it('rejects an invalid timezone', async () => {
      const res = await http()
        .post('/partner/venues')
        .set(auth('alice-token'))
        .send({ ...validVenue, timezone: 'Mars/Olympus' })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('IANA timezone')]),
      );
    });

    it('rejects an unknown amenity value', async () => {
      const res = await http()
        .post('/partner/venues')
        .set(auth('alice-token'))
        .send({ ...validVenue, amenityIds: ['SHOWER', 'JACUZZI'] })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('amenityIds')]),
      );
    });

    it('rejects duplicate amenities', async () => {
      await http()
        .post('/partner/venues')
        .set(auth('alice-token'))
        .send({ ...validVenue, amenityIds: ['SHOWER', 'SHOWER'] })
        .expect(400);
    });
  });

  describe('PATCH /partner/venues/:id', () => {
    it("updates the partner's own venue with a subset of fields", async () => {
      const res = await http()
        .patch(`/partner/venues/${YOGA_ACTIVE}`)
        .set(auth('alice-token'))
        .send({ name: 'Renamed', amenityIds: ['LOCKERS'] })
        .expect(200);

      expect(res.body).toMatchObject({
        id: YOGA_ACTIVE,
        name: 'Renamed',
        amenityIds: ['LOCKERS'],
        city: 'Istanbul',
      });
    });

    it("cannot update another partner's venue", async () => {
      const res = await http()
        .patch(`/partner/venues/${PILATES_VENUE}`)
        .set(auth('alice-token'))
        .send({ name: 'Hijacked' })
        .expect(404);

      expect(res.body.message).toBe('Venue not found');
      expect(venues.find((v) => v.id === PILATES_VENUE)?.name).toBe(
        'Pilates Central',
      );
    });

    it('returns the same 404 for a venue that does not exist', async () => {
      await http()
        .patch(`/partner/venues/${UNKNOWN_VENUE}`)
        .set(auth('alice-token'))
        .send({ name: 'x' })
        .expect(404);
    });

    it('rejects an empty body', async () => {
      const res = await http()
        .patch(`/partner/venues/${YOGA_ACTIVE}`)
        .set(auth('alice-token'))
        .send({})
        .expect(400);

      expect(res.body.message).toBe('Provide at least one field to update');
    });

    it('rejects status, partnerId and invalid values', async () => {
      const url = `/partner/venues/${YOGA_ACTIVE}`;
      await http()
        .patch(url)
        .set(auth('alice-token'))
        .send({ status: 'ARCHIVED' })
        .expect(400);
      await http()
        .patch(url)
        .set(auth('alice-token'))
        .send({ partnerId: PILATES_CO })
        .expect(400);
      await http()
        .patch(url)
        .set(auth('alice-token'))
        .send({ timezone: 'Nope/Nope' })
        .expect(400);
      await http()
        .patch(url)
        .set(auth('alice-token'))
        .send({ amenityIds: ['POOL'] })
        .expect(400);
      await http()
        .patch(url)
        .set(auth('alice-token'))
        .send({ name: '' })
        .expect(400);
    });

    it('rejects a malformed venue id', async () => {
      await http()
        .patch('/partner/venues/not-a-uuid')
        .set(auth('alice-token'))
        .send({ name: 'x' })
        .expect(400);
    });
  });

  describe('POST /partner/venues/:id/archive', () => {
    it("archives the partner's own venue and hides it from the default list", async () => {
      const res = await http()
        .post(`/partner/venues/${YOGA_ACTIVE}/archive`)
        .set(auth('alice-token'))
        .expect(200);

      expect(res.body).toMatchObject({ id: YOGA_ACTIVE, status: 'ARCHIVED' });
      expect(venues.some((v) => v.id === YOGA_ACTIVE)).toBe(true); // soft delete: row kept
      const list = await http()
        .get('/partner/venues')
        .set(auth('alice-token'))
        .expect(200);
      expect(list.body).toEqual([]);
    });

    it("cannot archive another partner's venue", async () => {
      await http()
        .post(`/partner/venues/${PILATES_VENUE}/archive`)
        .set(auth('alice-token'))
        .expect(404);

      expect(venues.find((v) => v.id === PILATES_VENUE)?.status).toBe('ACTIVE');
    });

    it('is idempotent for an already archived venue', async () => {
      const res = await http()
        .post(`/partner/venues/${YOGA_ARCHIVED}/archive`)
        .set(auth('alice-token'))
        .expect(200);

      expect(res.body.status).toBe('ARCHIVED');
    });
  });
});
