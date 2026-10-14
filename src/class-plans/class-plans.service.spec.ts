import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { VenueStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../lib/database/prisma.service.js';
import { ClassPlansService } from './class-plans.service.js';
import { CreateClassPlanDto } from './dto/create-class-plan.dto.js';
import { SessionGenerationService } from './session-generation.service.js';

const PARTNER_ID = '11111111-1111-4111-8111-111111111111';
const CLASS_TYPE_ID = '22222222-2222-4222-8222-222222222222';
const VENUE_ID = '33333333-3333-4333-8333-333333333333';
const INSTRUCTOR_ID = '44444444-4444-4444-8444-444444444444';

const ONE_TIME_DTO = {
  classTypeId: CLASS_TYPE_ID,
  venueId: VENUE_ID,
  recurrenceType: 'ONE_TIME',
  startDate: '2026-10-14',
  startTime: '18:00',
  durationMinutes: 60,
  totalCapacity: 30,
  classistaCapacity: 20,
} as CreateClassPlanDto;

const RECURRING_DTO = {
  ...ONE_TIME_DTO,
  recurrenceType: 'RECURRING',
  startDate: '2026-10-01',
  endDate: '2026-12-31',
  weekdays: [3, 1],
} as CreateClassPlanDto;

// A plan as Prisma returns it.
const createdPlan = {
  id: 'plan-1',
  classTypeId: CLASS_TYPE_ID,
  venueId: VENUE_ID,
  instructorId: null,
  title: 'Puppy Yoga',
  description: null,
  recurrenceType: 'RECURRING',
  startDate: new Date('2026-10-01T00:00:00.000Z'),
  endDate: new Date('2026-12-31T00:00:00.000Z'),
  weekdays: [1, 3],
  startTime: new Date('1970-01-01T18:00:00.000Z'),
  durationMinutes: 60,
  totalCapacity: 30,
  classistaCapacity: 20,
  status: 'ACTIVE',
  createdAt: new Date('2026-10-13T10:00:00.000Z'),
  updatedAt: new Date('2026-10-13T10:00:00.000Z'),
  venue: { timezone: 'Europe/Istanbul' },
};

describe('ClassPlansService', () => {
  const txMock = { classPlan: { create: vi.fn() } };
  const prismaMock = {
    classPlan: { findMany: vi.fn() },
    classType: { findFirst: vi.fn() },
    venue: { findFirst: vi.fn() },
    instructor: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  };
  const generationMock = { generateForPlan: vi.fn() };

  let service: ClassPlansService;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-13T09:00:00.000Z'));

    txMock.classPlan.create.mockReset().mockResolvedValue(createdPlan);
    prismaMock.classPlan.findMany.mockReset();
    prismaMock.classType.findFirst
      .mockReset()
      .mockResolvedValue({ name: 'Puppy Yoga', isActive: true });
    prismaMock.venue.findFirst
      .mockReset()
      .mockResolvedValue({
        status: VenueStatus.ACTIVE,
        timezone: 'Europe/Istanbul',
      });
    prismaMock.instructor.findFirst
      .mockReset()
      .mockResolvedValue({ isActive: true });
    prismaMock.$transaction
      .mockReset()
      .mockImplementation(async (callback) => callback(txMock));
    generationMock.generateForPlan.mockReset().mockResolvedValue(9);

    const module = await Test.createTestingModule({
      providers: [
        ClassPlansService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SessionGenerationService, useValue: generationMock },
      ],
    }).compile();

    service = module.get(ClassPlansService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('findAll', () => {
    it("lists only the partner's plans, with dates and times as text", async () => {
      prismaMock.classPlan.findMany.mockResolvedValue([createdPlan]);

      const result = await service.findAll(PARTNER_ID);

      expect(prismaMock.classPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { classType: { partnerId: PARTNER_ID } },
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'plan-1',
        startDate: '2026-10-01',
        endDate: '2026-12-31',
        startTime: '18:00',
        weekdays: [1, 3],
      });
      expect(result[0]).not.toHaveProperty('venue');
    });
  });

  describe('create', () => {
    it('saves the plan with a title copied from the Class Type name', async () => {
      await service.create(PARTNER_ID, RECURRING_DTO);

      expect(txMock.classPlan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Puppy Yoga',
            classTypeId: CLASS_TYPE_ID,
            venueId: VENUE_ID,
            startDate: new Date('2026-10-01T00:00:00.000Z'),
            endDate: new Date('2026-12-31T00:00:00.000Z'),
            startTime: new Date('1970-01-01T18:00:00.000Z'),
            weekdays: [1, 3], // sorted
            durationMinutes: 60,
            totalCapacity: 30,
            classistaCapacity: 20,
          }),
        }),
      );
    });

    it('stores no weekdays and no end date for a one-time plan', async () => {
      await service.create(PARTNER_ID, ONE_TIME_DTO);

      const [{ data }] = txMock.classPlan.create.mock.calls[0];
      expect(data.weekdays).toEqual([]);
      expect(data.endDate).toBeNull();
    });

    it('generates the sessions inside the same transaction', async () => {
      await service.create(PARTNER_ID, RECURRING_DTO);

      expect(generationMock.generateForPlan).toHaveBeenCalledWith(createdPlan, {
        db: txMock,
      });
    });

    it('does not create the plan when generation fails', async () => {
      generationMock.generateForPlan.mockRejectedValue(new Error('boom'));
      // A real transaction rolls back when the callback throws; the mock
      // passes the error through. The real rollback is checked in Step 8.

      await expect(service.create(PARTNER_ID, RECURRING_DTO)).rejects.toThrow(
        'boom',
      );
    });

    it('returns the plan with dates and times as text', async () => {
      const result = await service.create(PARTNER_ID, RECURRING_DTO);

      expect(result).toMatchObject({
        id: 'plan-1',
        title: 'Puppy Yoga',
        startDate: '2026-10-01',
        startTime: '18:00',
        status: 'ACTIVE',
      });
    });

    describe('Class Type, venue, and instructor checks', () => {
      it("looks them up by the caller's partner", async () => {
        await service.create(PARTNER_ID, {
          ...RECURRING_DTO,
          instructorId: INSTRUCTOR_ID,
        });

        expect(prismaMock.classType.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: CLASS_TYPE_ID, partnerId: PARTNER_ID },
          }),
        );
        expect(prismaMock.venue.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: VENUE_ID, partnerId: PARTNER_ID },
          }),
        );
        expect(prismaMock.instructor.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: INSTRUCTOR_ID, partnerId: PARTNER_ID },
          }),
        );
      });

      it('skips the instructor lookup when none is given', async () => {
        await service.create(PARTNER_ID, RECURRING_DTO);

        expect(prismaMock.instructor.findFirst).not.toHaveBeenCalled();
      });

      it('rejects an unknown or other partner Class Type', async () => {
        prismaMock.classType.findFirst.mockResolvedValue(null);

        await expect(service.create(PARTNER_ID, RECURRING_DTO)).rejects.toThrow(
          new BadRequestException('Class Type not found'),
        );
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });

      it('rejects an archived Class Type', async () => {
        prismaMock.classType.findFirst.mockResolvedValue({
          name: 'Puppy Yoga',
          isActive: false,
        });

        await expect(service.create(PARTNER_ID, RECURRING_DTO)).rejects.toThrow(
          new BadRequestException('Class Type is archived'),
        );
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });

      it('rejects an unknown or other partner venue', async () => {
        prismaMock.venue.findFirst.mockResolvedValue(null);

        await expect(service.create(PARTNER_ID, RECURRING_DTO)).rejects.toThrow(
          new BadRequestException('Venue not found'),
        );
      });

      it('rejects an archived venue', async () => {
        prismaMock.venue.findFirst.mockResolvedValue({
          status: VenueStatus.ARCHIVED,
          timezone: 'Europe/Istanbul',
        });

        await expect(service.create(PARTNER_ID, RECURRING_DTO)).rejects.toThrow(
          new BadRequestException('Venue is archived'),
        );
      });

      it('rejects an unknown or other partner instructor', async () => {
        prismaMock.instructor.findFirst.mockResolvedValue(null);

        await expect(
          service.create(PARTNER_ID, {
            ...RECURRING_DTO,
            instructorId: INSTRUCTOR_ID,
          }),
        ).rejects.toThrow(new BadRequestException('Instructor not found'));
      });

      it('rejects an inactive instructor', async () => {
        prismaMock.instructor.findFirst.mockResolvedValue({ isActive: false });

        await expect(
          service.create(PARTNER_ID, {
            ...RECURRING_DTO,
            instructorId: INSTRUCTOR_ID,
          }),
        ).rejects.toThrow(new BadRequestException('Instructor is inactive'));
      });
    });

    describe('one-time plans must start in the future', () => {
      // "Now" is 2026-10-13 12:00 in Istanbul.
      it('accepts a class later today', async () => {
        await expect(
          service.create(PARTNER_ID, {
            ...ONE_TIME_DTO,
            startDate: '2026-10-13',
            startTime: '12:01',
          }),
        ).resolves.toBeDefined();
      });

      it('rejects a class that already started today', async () => {
        await expect(
          service.create(PARTNER_ID, {
            ...ONE_TIME_DTO,
            startDate: '2026-10-13',
            startTime: '11:59',
          }),
        ).rejects.toThrow(
          new BadRequestException('A one-time class must start in the future'),
        );
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });

      it('rejects a class exactly at the current time', async () => {
        await expect(
          service.create(PARTNER_ID, {
            ...ONE_TIME_DTO,
            startDate: '2026-10-13',
            startTime: '12:00',
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
      });

      it('lets a recurring plan start today even if its class time has passed', async () => {
        await expect(
          service.create(PARTNER_ID, {
            ...RECURRING_DTO,
            startDate: '2026-10-13',
            startTime: '08:00',
          }),
        ).resolves.toBeDefined();
      });
    });
  });
});
