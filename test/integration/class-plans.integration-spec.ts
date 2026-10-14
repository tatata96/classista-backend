// Class plan behaviour that mocked Prisma cannot prove: transactions rolling
// back, and the database refusing duplicate sessions. Runs against the local
// test database only (see test-database.ts). Run with:
//   TEST_DATABASE_URL=postgresql://test:test@127.0.0.1:54329/classista_test \
//     npm run test:integration
import { ClassPlansService } from '../../src/class-plans/class-plans.service.js';
import { CreateClassPlanDto } from '../../src/class-plans/dto/create-class-plan.dto.js';
import {
  PlanForGeneration,
  SessionGenerationService,
} from '../../src/class-plans/session-generation/session-generation.service.js';
import {
  localDateToDbDate,
  localTimeToDbTime,
} from '../../src/class-plans/zoned-time.js';
import type { PartnerStatus } from '../../src/generated/prisma/enums.js';
import { PrismaService } from '../../src/lib/database/prisma.service.js';
import { createTestPrisma, resetDatabase } from './test-database.js';

// Wednesday 2026-10-14, 12:00 in Istanbul. A 30-day window from here ends on
// Friday 2026-11-13, 12:00 in Istanbul (09:00 UTC).
const NOW = new Date('2026-10-14T09:00:00.000Z');

// A Monday/Wednesday 18:00 class (15:00 UTC) in that window.
const MONDAY_WEDNESDAY_STARTS = [
  '2026-10-14T15:00:00.000Z',
  '2026-10-19T15:00:00.000Z',
  '2026-10-21T15:00:00.000Z',
  '2026-10-26T15:00:00.000Z',
  '2026-10-28T15:00:00.000Z',
  '2026-11-02T15:00:00.000Z',
  '2026-11-04T15:00:00.000Z',
  '2026-11-09T15:00:00.000Z',
  '2026-11-11T15:00:00.000Z',
];

describe('class plans (real database)', () => {
  let prisma: PrismaService;
  let generation: SessionGenerationService;
  let plans: ClassPlansService;

  beforeAll(async () => {
    prisma = await createTestPrisma();
    generation = new SessionGenerationService(prisma);
    plans = new ClassPlansService(prisma, generation);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    // Only Date is faked, so database calls keep working normally.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  let counter = 0;

  // A partner with everything a plan needs.
  async function seedPartner(status: PartnerStatus = 'ACTIVE') {
    counter += 1;
    const partner = await prisma.partner.create({
      data: { name: `Partner ${counter}`, status },
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
    return { partner, classType, venue };
  }

  const recurringDto = (
    seed: Awaited<ReturnType<typeof seedPartner>>,
    overrides: Partial<CreateClassPlanDto> = {},
  ) =>
    ({
      classTypeId: seed.classType.id,
      venueId: seed.venue.id,
      recurrenceType: 'RECURRING',
      startDate: '2026-10-01',
      weekdays: [1, 3],
      startTime: '18:00',
      durationMinutes: 60,
      totalCapacity: 30,
      classistaCapacity: 20,
      ...overrides,
    }) as CreateClassPlanDto;

  // A plan row inserted directly, bypassing the service (so it has no sessions yet).
  async function insertPlan(
    seed: Awaited<ReturnType<typeof seedPartner>>,
    overrides: Record<string, unknown> = {},
  ): Promise<PlanForGeneration> {
    return prisma.classPlan.create({
      data: {
        classTypeId: seed.classType.id,
        venueId: seed.venue.id,
        title: seed.classType.name,
        recurrenceType: 'RECURRING',
        startDate: localDateToDbDate('2026-10-01'),
        weekdays: [1, 3],
        startTime: localTimeToDbTime('18:00'),
        durationMinutes: 60,
        totalCapacity: 30,
        classistaCapacity: 20,
        ...overrides,
      },
      include: { venue: { select: { timezone: true } } },
    });
  }

  const sessionStarts = async (classPlanId?: string) =>
    (
      await prisma.classSession.findMany({
        where: { classPlanId },
        orderBy: { startAt: 'asc' },
      })
    ).map((session) => session.startAt.toISOString());

  describe('creating a plan', () => {
    it('saves a recurring plan together with its sessions in the 30-day window', async () => {
      const seed = await seedPartner();

      const plan = await plans.create(seed.partner.id, recurringDto(seed));

      expect(await prisma.classPlan.count()).toBe(1);
      expect(await sessionStarts(plan.id)).toEqual(MONDAY_WEDNESDAY_STARTS);

      const [first] = await prisma.classSession.findMany({
        orderBy: { startAt: 'asc' },
        take: 1,
      });
      expect(first).toMatchObject({
        classPlanId: plan.id,
        venueId: seed.venue.id,
        totalCapacity: 30,
        classistaCapacity: 20,
        status: 'SCHEDULED',
      });
      expect(first.endAt.toISOString()).toBe('2026-10-14T16:00:00.000Z');
    });

    it('creates one session for a one-time plan, even beyond the 30-day window', async () => {
      const seed = await seedPartner();

      const plan = await plans.create(
        seed.partner.id,
        recurringDto(seed, {
          recurrenceType: 'ONE_TIME',
          startDate: '2026-12-25',
          weekdays: undefined,
        }),
      );

      expect(await sessionStarts(plan.id)).toEqual([
        '2026-12-25T15:00:00.000Z',
      ]);
    });

    it('rolls back the plan and its sessions when generation fails afterwards', async () => {
      const seed = await seedPartner();
      const realGenerate = generation.generateForPlan.bind(generation);
      let sessionsWrittenInsideTransaction = 0;
      vi.spyOn(generation, 'generateForPlan').mockImplementation(
        async (plan, options) => {
          // Really write the sessions inside the transaction, then fail.
          sessionsWrittenInsideTransaction = await realGenerate(plan, options);
          throw new Error('failure after the sessions were written');
        },
      );

      await expect(
        plans.create(seed.partner.id, recurringDto(seed)),
      ).rejects.toThrow('failure after the sessions were written');

      // The writes really happened inside the transaction...
      expect(sessionsWrittenInsideTransaction).toBe(9);
      // ...and none of them survived.
      expect(await prisma.classPlan.count()).toBe(0);
      expect(await prisma.classSession.count()).toBe(0);
    });

    it('leaves nothing behind when a check fails before the transaction', async () => {
      const seed = await seedPartner();
      await prisma.classType.update({
        where: { id: seed.classType.id },
        data: { isActive: false },
      });

      await expect(
        plans.create(seed.partner.id, recurringDto(seed)),
      ).rejects.toThrow('Class Type is archived');

      expect(await prisma.classPlan.count()).toBe(0);
    });
  });

  describe('duplicate prevention', () => {
    it('creates no duplicates when generation runs again', async () => {
      const seed = await seedPartner();
      const plan = await insertPlan(seed);

      expect(await generation.generateForPlan(plan, { now: NOW })).toBe(9);
      expect(await generation.generateForPlan(plan, { now: NOW })).toBe(0);

      expect(await sessionStarts(plan.id)).toEqual(MONDAY_WEDNESDAY_STARTS);
    });

    it('creates no duplicates when generation runs at the same moment', async () => {
      const seed = await seedPartner();
      const plan = await insertPlan(seed);

      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          generation.generateForPlan(plan, { now: NOW }),
        ),
      );

      // Exactly one of the runs created each session.
      expect(results.reduce((total, created) => total + created, 0)).toBe(9);
      expect(await sessionStarts(plan.id)).toEqual(MONDAY_WEDNESDAY_STARTS);
    });

    it('only adds the newly in-range session when the window moves forward', async () => {
      const seed = await seedPartner();
      const plan = await insertPlan(seed);
      await generation.generateForPlan(plan, { now: NOW });

      // Five days later the window reaches Monday 2026-11-16.
      const later = new Date('2026-10-19T09:00:00.000Z');
      expect(await generation.generateForPlan(plan, { now: later })).toBe(1);

      expect(await sessionStarts(plan.id)).toEqual([
        ...MONDAY_WEDNESDAY_STARTS,
        '2026-11-16T15:00:00.000Z',
      ]);
    });

    it('is enforced by the database itself, not only by skipDuplicates', async () => {
      const seed = await seedPartner();
      const plan = await insertPlan(seed);
      const session = {
        classPlanId: plan.id,
        venueId: seed.venue.id,
        startAt: new Date('2026-10-14T15:00:00.000Z'),
        endAt: new Date('2026-10-14T16:00:00.000Z'),
        totalCapacity: 30,
        classistaCapacity: 20,
      };
      await prisma.classSession.create({ data: session });

      await expect(
        prisma.classSession.create({ data: session }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });
  });

  describe('the daily job (generateForActivePlans)', () => {
    it('extends only active recurring plans of active partners that have not ended', async () => {
      const seed = await seedPartner();
      const inactive = await seedPartner('INACTIVE');

      const active = await insertPlan(seed);
      const endsToday = await insertPlan(seed, {
        endDate: localDateToDbDate('2026-10-14'),
      });
      // The query keeps plans that ended yesterday (a day of slack, see
      // generateForActivePlans); generateForPlan then finds nothing left to make.
      const endedYesterday = await insertPlan(seed, {
        endDate: localDateToDbDate('2026-10-13'),
      });
      const endedLongAgo = await insertPlan(seed, {
        endDate: localDateToDbDate('2026-10-12'),
      });
      const paused = await insertPlan(seed, { status: 'PAUSED' });
      const oneTime = await insertPlan(seed, {
        recurrenceType: 'ONE_TIME',
        startDate: localDateToDbDate('2026-10-20'),
        weekdays: [],
      });
      const ofInactivePartner = await insertPlan(inactive);

      const summary = await generation.generateForActivePlans(NOW);

      expect(summary).toEqual({
        plans: 3, // active, endsToday, endedYesterday
        sessionsCreated: 10,
        failedPlans: 0,
      });
      expect(await sessionStarts(active.id)).toEqual(MONDAY_WEDNESDAY_STARTS);
      // The end date is inclusive: today's class (Wednesday 18:00) is still made.
      expect(await sessionStarts(endsToday.id)).toEqual([
        '2026-10-14T15:00:00.000Z',
      ]);
      for (const skipped of [
        endedYesterday,
        endedLongAgo,
        paused,
        oneTime,
        ofInactivePartner,
      ]) {
        expect(await sessionStarts(skipped.id)).toEqual([]);
      }
    });

    it('creates nothing new when run twice in a row', async () => {
      const seed = await seedPartner();
      await insertPlan(seed);

      await generation.generateForActivePlans(NOW);
      const second = await generation.generateForActivePlans(NOW);

      expect(second).toEqual({ plans: 1, sessionsCreated: 0, failedPlans: 0 });
      expect(await prisma.classSession.count()).toBe(9);
    });
  });
});
