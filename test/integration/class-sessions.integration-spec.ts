// Behaviour of GET /partner/class-sessions that mocked Prisma cannot prove: the
// day boundaries, partner isolation, and ordering as the database applies them.
// Runs against the local test database only (see test-database.ts). Run with:
//   TEST_DATABASE_URL=postgresql://test:test@127.0.0.1:54329/classista_test \
//     npm run test:integration
import { ClassSessionsService } from '../../src/class-sessions/class-sessions.service.js';
import {
  localDateToDbDate,
  localTimeToDbTime,
} from '../../src/class-plans/zoned-time.js';
import type { SessionStatus } from '../../src/generated/prisma/enums.js';
import { PrismaService } from '../../src/lib/database/prisma.service.js';
import { createTestPrisma, resetDatabase } from './test-database.js';

describe('class sessions listing (real database)', () => {
  let prisma: PrismaService;
  let service: ClassSessionsService;

  beforeAll(async () => {
    prisma = await createTestPrisma();
    service = new ClassSessionsService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  let counter = 0;

  async function seedPartner(withInstructor = false) {
    counter += 1;
    const partner = await prisma.partner.create({
      data: { name: `Partner ${counter}` },
    });
    const category = await prisma.category.create({
      data: { name: `Category ${counter}`, slug: `category-${counter}` },
    });
    const classType = await prisma.classType.create({
      data: {
        partnerId: partner.id,
        categoryId: category.id,
        name: `Puppy Yoga ${counter}`,
      },
    });
    const venue = await prisma.venue.create({
      data: {
        partnerId: partner.id,
        name: `Venue ${counter}`,
        addressLine: 'Bahariye Caddesi 12',
        district: 'Kadıköy',
        city: 'Istanbul',
        timezone: 'Europe/Istanbul',
      },
    });
    const instructor = withInstructor
      ? await prisma.instructor.create({
          data: { partnerId: partner.id, name: `Instructor ${counter}` },
        })
      : null;
    const plan = await prisma.classPlan.create({
      data: {
        classTypeId: classType.id,
        venueId: venue.id,
        instructorId: instructor?.id ?? null,
        title: classType.name,
        description: 'Bring a mat',
        recurrenceType: 'RECURRING',
        startDate: localDateToDbDate('2026-10-01'),
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        startTime: localTimeToDbTime('18:00'),
        durationMinutes: 60,
        totalCapacity: 30,
        classistaCapacity: 20,
      },
    });
    return { partner, category, classType, venue, instructor, plan };
  }

  type Seed = Awaited<ReturnType<typeof seedPartner>>;

  const addSession = (
    seed: Seed,
    startAt: string,
    status: SessionStatus = 'SCHEDULED',
  ) =>
    prisma.classSession.create({
      data: {
        classPlanId: seed.plan.id,
        venueId: seed.venue.id,
        instructorId: seed.instructor?.id ?? null,
        startAt: new Date(startAt),
        endAt: new Date(new Date(startAt).getTime() + 60 * 60_000),
        totalCapacity: 30,
        classistaCapacity: 20,
        status,
      },
    });

  const starts = async (seed: Seed, date: string) =>
    (await service.findByDate(seed.partner.id, date)).map((s) => s.startAt);

  it('returns an empty array for a day with no sessions', async () => {
    const seed = await seedPartner();
    await addSession(seed, '2026-10-15T15:00:00.000Z');

    expect(await service.findByDate(seed.partner.id, '2026-10-14')).toEqual([]);
  });

  describe('Istanbul day boundaries (UTC+3)', () => {
    it('includes a session exactly at the start of the day and excludes one exactly at the next day start', async () => {
      const seed = await seedPartner();
      await addSession(seed, '2026-10-13T20:59:59.999Z'); // 23:59:59.999 the day before
      await addSession(seed, '2026-10-13T21:00:00.000Z'); // 00:00 on the 14th: included
      await addSession(seed, '2026-10-14T20:59:59.999Z'); // 23:59:59.999 on the 14th: included
      await addSession(seed, '2026-10-14T21:00:00.000Z'); // 00:00 on the 15th: excluded

      expect(await starts(seed, '2026-10-14')).toEqual([
        '2026-10-13T21:00:00.000Z',
        '2026-10-14T20:59:59.999Z',
      ]);
      expect(await starts(seed, '2026-10-15')).toEqual([
        '2026-10-14T21:00:00.000Z',
      ]);
      expect(await starts(seed, '2026-10-13')).toEqual([
        '2026-10-13T20:59:59.999Z',
      ]);
    });

    it('puts a late-evening Istanbul session on its Istanbul date, not its UTC date', async () => {
      const seed = await seedPartner();
      await addSession(seed, '2026-10-14T00:30:00.000Z'); // 03:30 Istanbul, 14th (also 14th UTC)
      await addSession(seed, '2026-10-14T22:00:00.000Z'); // 01:00 Istanbul on the 15th (14th UTC)

      expect(await starts(seed, '2026-10-14')).toEqual([
        '2026-10-14T00:30:00.000Z',
      ]);
      expect(await starts(seed, '2026-10-15')).toEqual([
        '2026-10-14T22:00:00.000Z',
      ]);
    });
  });

  it('orders by startAt ascending regardless of insertion order, and by id for equal starts', async () => {
    const seed = await seedPartner();
    const other = await prisma.classPlan.create({
      data: {
        classTypeId: seed.classType.id,
        venueId: seed.venue.id,
        title: 'Second plan',
        recurrenceType: 'ONE_TIME',
        startDate: localDateToDbDate('2026-10-14'),
        weekdays: [],
        startTime: localTimeToDbTime('09:00'),
        durationMinutes: 60,
        totalCapacity: 10,
        classistaCapacity: 5,
      },
    });
    await addSession(seed, '2026-10-14T15:00:00.000Z');
    await addSession(seed, '2026-10-14T06:00:00.000Z');
    const tied = await prisma.classSession.create({
      data: {
        classPlanId: other.id,
        venueId: seed.venue.id,
        startAt: new Date('2026-10-14T06:00:00.000Z'),
        endAt: new Date('2026-10-14T07:00:00.000Z'),
        totalCapacity: 10,
        classistaCapacity: 5,
      },
    });

    const result = await service.findByDate(seed.partner.id, '2026-10-14');

    expect(result.map((s) => s.startAt)).toEqual([
      '2026-10-14T06:00:00.000Z',
      '2026-10-14T06:00:00.000Z',
      '2026-10-14T15:00:00.000Z',
    ]);
    const tiedIds = result.slice(0, 2).map((s) => s.id);
    expect(tiedIds).toEqual([...tiedIds].sort());
    expect(tiedIds).toContain(tied.id);
  });

  it("never returns another partner's sessions", async () => {
    const mine = await seedPartner();
    const theirs = await seedPartner();
    const mySession = await addSession(mine, '2026-10-14T15:00:00.000Z');
    await addSession(theirs, '2026-10-14T15:00:00.000Z');

    const result = await service.findByDate(mine.partner.id, '2026-10-14');
    const theirResult = await service.findByDate(
      theirs.partner.id,
      '2026-10-14',
    );

    expect(result.map((s) => s.id)).toEqual([mySession.id]);
    expect(theirResult).toHaveLength(1);
    expect(theirResult[0].id).not.toBe(mySession.id);
  });

  it('returns the full contract, with stored status, regardless of plan status', async () => {
    const seed = await seedPartner(true);
    const session = await addSession(
      seed,
      '2026-10-14T15:00:00.000Z',
      'CANCELLED',
    );
    await prisma.classPlan.update({
      where: { id: seed.plan.id },
      data: { status: 'PAUSED' },
    });

    expect(await service.findByDate(seed.partner.id, '2026-10-14')).toEqual([
      {
        id: session.id,
        classPlanId: seed.plan.id,
        venueId: seed.venue.id,
        instructorId: seed.instructor!.id,
        startAt: '2026-10-14T15:00:00.000Z',
        endAt: '2026-10-14T16:00:00.000Z',
        totalCapacity: 30,
        classistaCapacity: 20,
        status: 'CANCELLED',
        title: seed.classType.name,
        description: 'Bring a mat',
        categoryId: seed.category.id,
        venueName: seed.venue.name,
        instructorName: seed.instructor!.name,
      },
    ]);
  });

  it('returns null instructor fields for a session with no instructor', async () => {
    const seed = await seedPartner(false);
    await addSession(seed, '2026-10-14T15:00:00.000Z');

    const [session] = await service.findByDate(seed.partner.id, '2026-10-14');

    expect(session.instructorId).toBeNull();
    expect(session.instructorName).toBeNull();
  });

  it('does not create sessions (read-only)', async () => {
    const seed = await seedPartner();

    await service.findByDate(seed.partner.id, '2026-10-14');

    expect(await prisma.classSession.count()).toBe(0);
  });
});
