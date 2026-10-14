import { Test } from '@nestjs/testing';
import { ClassPlanStatus, RecurrenceType } from '../generated/prisma/enums.js';
import { PrismaService } from '../lib/database/prisma.service.js';
import {
  PlanForGeneration,
  SessionGenerationService,
} from './session-generation.service.js';

// What Prisma returns for a one-time plan on 2026-10-14 at 18:00 for 60 minutes.
function buildPlan(
  overrides: Partial<PlanForGeneration> = {},
): PlanForGeneration {
  return {
    id: 'plan-1',
    classTypeId: 'class-type-1',
    venueId: 'venue-1',
    instructorId: 'instructor-1',
    title: 'Puppy Yoga',
    description: null,
    startDate: new Date('2026-10-14T00:00:00.000Z'),
    endDate: null,
    recurrenceType: RecurrenceType.ONE_TIME,
    weekdays: [],
    startTime: new Date('1970-01-01T18:00:00.000Z'),
    durationMinutes: 60,
    totalCapacity: 30,
    classistaCapacity: 20,
    status: ClassPlanStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    venue: { timezone: 'Europe/Istanbul' },
    ...overrides,
  };
}

describe('SessionGenerationService', () => {
  const prismaMock = { classSession: { createMany: vi.fn() } };
  const transactionClientMock = { classSession: { createMany: vi.fn() } };

  let service: SessionGenerationService;

  beforeEach(async () => {
    prismaMock.classSession.createMany.mockReset();
    transactionClientMock.classSession.createMany.mockReset();

    const module = await Test.createTestingModule({
      providers: [
        SessionGenerationService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(SessionGenerationService);
  });

  describe('one-time plan', () => {
    it('creates exactly one session at the venue-local start time', async () => {
      prismaMock.classSession.createMany.mockResolvedValue({ count: 1 });

      const created = await service.generateForPlan(buildPlan());

      expect(created).toBe(1);
      expect(prismaMock.classSession.createMany).toHaveBeenCalledWith({
        data: [
          {
            classPlanId: 'plan-1',
            venueId: 'venue-1',
            instructorId: 'instructor-1',
            // 18:00 in Istanbul (UTC+3) is 15:00 UTC.
            startAt: new Date('2026-10-14T15:00:00.000Z'),
            endAt: new Date('2026-10-14T16:00:00.000Z'),
            totalCapacity: 30,
            classistaCapacity: 20,
          },
        ],
        skipDuplicates: true,
      });
    });

    it('ends exactly at midnight for a 23:00 class of 60 minutes', async () => {
      prismaMock.classSession.createMany.mockResolvedValue({ count: 1 });

      await service.generateForPlan(
        buildPlan({
          startTime: new Date('1970-01-01T23:00:00.000Z'),
          durationMinutes: 60,
        }),
      );

      const [{ data }] = prismaMock.classSession.createMany.mock.calls[0];
      expect(data[0].startAt).toEqual(new Date('2026-10-14T20:00:00.000Z'));
      // 21:00 UTC is 00:00 on 2026-10-15 in Istanbul.
      expect(data[0].endAt).toEqual(new Date('2026-10-14T21:00:00.000Z'));
    });

    it('leaves the instructor empty when the plan has none', async () => {
      prismaMock.classSession.createMany.mockResolvedValue({ count: 1 });

      await service.generateForPlan(buildPlan({ instructorId: null }));

      const [{ data }] = prismaMock.classSession.createMany.mock.calls[0];
      expect(data[0].instructorId).toBeNull();
    });

    it('reports 0 when the session already exists', async () => {
      prismaMock.classSession.createMany.mockResolvedValue({ count: 0 });

      expect(await service.generateForPlan(buildPlan())).toBe(0);
    });

    it('writes with the transaction client when one is given', async () => {
      transactionClientMock.classSession.createMany.mockResolvedValue({
        count: 1,
      });

      await service.generateForPlan(buildPlan(), {
        db: transactionClientMock as never,
      });

      expect(
        transactionClientMock.classSession.createMany,
      ).toHaveBeenCalledTimes(1);
      expect(prismaMock.classSession.createMany).not.toHaveBeenCalled();
    });
  });

  it('creates nothing for a paused plan', async () => {
    const created = await service.generateForPlan(
      buildPlan({ status: ClassPlanStatus.PAUSED }),
    );

    expect(created).toBe(0);
    expect(prismaMock.classSession.createMany).not.toHaveBeenCalled();
  });

  describe('recurring plan', () => {
    // Wednesday 2026-10-14, 12:00 in Istanbul. The window ends Friday
    // 2026-11-13 at 12:00 Istanbul (09:00 UTC).
    const NOW = new Date('2026-10-14T09:00:00.000Z');

    const buildRecurring = (overrides: Partial<PlanForGeneration> = {}) =>
      buildPlan({
        recurrenceType: RecurrenceType.RECURRING,
        startDate: new Date('2026-10-01T00:00:00.000Z'),
        weekdays: [1, 3], // Monday and Wednesday
        ...overrides,
      });

    // The start instants of the sessions the service asked Prisma to create.
    const createdStartTimes = () =>
      prismaMock.classSession.createMany.mock.calls[0][0].data.map(
        (session: { startAt: Date }) => session.startAt.toISOString(),
      );

    beforeEach(() => {
      prismaMock.classSession.createMany.mockImplementation(
        async ({ data }: { data: unknown[] }) => ({ count: data.length }),
      );
    });

    it('creates every matching weekday inside the 30-day window', async () => {
      const created = await service.generateForPlan(buildRecurring(), {
        now: NOW,
      });

      // 18:00 Istanbul is 15:00 UTC. Today's Wednesday class has not started yet.
      expect(createdStartTimes()).toEqual([
        '2026-10-14T15:00:00.000Z', // Wed
        '2026-10-19T15:00:00.000Z', // Mon
        '2026-10-21T15:00:00.000Z', // Wed
        '2026-10-26T15:00:00.000Z', // Mon
        '2026-10-28T15:00:00.000Z', // Wed
        '2026-11-02T15:00:00.000Z', // Mon
        '2026-11-04T15:00:00.000Z', // Wed
        '2026-11-09T15:00:00.000Z', // Mon
        '2026-11-11T15:00:00.000Z', // Wed
      ]);
      expect(created).toBe(9);
    });

    it('copies the end time, venue, instructor, and both capacities', async () => {
      await service.generateForPlan(
        buildRecurring({ endDate: new Date('2026-10-14T00:00:00.000Z') }),
        { now: NOW },
      );

      expect(prismaMock.classSession.createMany.mock.calls[0][0].data).toEqual([
        {
          classPlanId: 'plan-1',
          venueId: 'venue-1',
          instructorId: 'instructor-1',
          startAt: new Date('2026-10-14T15:00:00.000Z'),
          endAt: new Date('2026-10-14T16:00:00.000Z'),
          totalCapacity: 30,
          classistaCapacity: 20,
        },
      ]);
    });

    it("skips today's class when it has already started", async () => {
      // 10:00 Istanbul is 07:00 UTC, before NOW.
      await service.generateForPlan(
        buildRecurring({ startTime: new Date('1970-01-01T10:00:00.000Z') }),
        { now: NOW },
      );

      expect(createdStartTimes()[0]).toBe('2026-10-19T07:00:00.000Z');
    });

    it('includes the end date itself', async () => {
      await service.generateForPlan(
        buildRecurring({ endDate: new Date('2026-10-21T00:00:00.000Z') }),
        { now: NOW },
      );

      expect(createdStartTimes()).toEqual([
        '2026-10-14T15:00:00.000Z',
        '2026-10-19T15:00:00.000Z',
        '2026-10-21T15:00:00.000Z', // the end date, a Wednesday
      ]);
    });

    it('starts at the plan start date when it is in the future', async () => {
      await service.generateForPlan(
        buildRecurring({ startDate: new Date('2026-11-01T00:00:00.000Z') }),
        { now: NOW },
      );

      expect(createdStartTimes()[0]).toBe('2026-11-02T15:00:00.000Z');
    });

    it('creates nothing for a plan that has already ended', async () => {
      const created = await service.generateForPlan(
        buildRecurring({ endDate: new Date('2026-10-13T00:00:00.000Z') }),
        { now: NOW },
      );

      expect(created).toBe(0);
      expect(prismaMock.classSession.createMany).not.toHaveBeenCalled();
    });

    it('includes a start exactly at the end of the window and excludes one just after', async () => {
      // Friday 2026-11-13 12:00 Istanbul is exactly NOW + 30 x 24 hours.
      const friday = {
        weekdays: [5],
        startDate: new Date('2026-11-13T00:00:00.000Z'),
      };

      await service.generateForPlan(
        buildRecurring({
          ...friday,
          startTime: new Date('1970-01-01T12:00:00.000Z'),
        }),
        { now: NOW },
      );
      expect(createdStartTimes()).toEqual(['2026-11-13T09:00:00.000Z']);

      prismaMock.classSession.createMany.mockClear();
      await service.generateForPlan(
        buildRecurring({
          ...friday,
          startTime: new Date('1970-01-01T12:01:00.000Z'),
        }),
        { now: NOW },
      );
      expect(prismaMock.classSession.createMany).not.toHaveBeenCalled();
    });

    it("uses the venue's date, not the UTC date, to decide what is today", async () => {
      // 21:30 UTC on Wednesday is already 00:30 on Thursday in Istanbul.
      const justAfterLocalMidnight = new Date('2026-10-14T21:30:00.000Z');

      await service.generateForPlan(
        buildRecurring({
          weekdays: [4], // Thursday
          startTime: new Date('1970-01-01T10:00:00.000Z'),
        }),
        { now: justAfterLocalMidnight },
      );

      // Thursday 10:00 Istanbul (07:00 UTC), the next morning.
      expect(createdStartTimes()[0]).toBe('2026-10-15T07:00:00.000Z');
    });

    it('creates nothing for a paused recurring plan', async () => {
      const created = await service.generateForPlan(
        buildRecurring({ status: ClassPlanStatus.PAUSED }),
        { now: NOW },
      );

      expect(created).toBe(0);
      expect(prismaMock.classSession.createMany).not.toHaveBeenCalled();
    });
  });
});
