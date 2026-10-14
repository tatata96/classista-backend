import { Test } from '@nestjs/testing';
import { PrismaService } from '../lib/database/prisma.service.js';
import { ClassSessionsService } from './class-sessions.service.js';

const PARTNER_ID = '11111111-1111-4111-8111-111111111111';

// A session row as Prisma returns it for the service's select.
const sessionRow = {
  id: 'session-1',
  classPlanId: 'plan-1',
  venueId: 'venue-1',
  instructorId: 'instructor-1',
  startAt: new Date('2026-10-14T15:00:00.000Z'),
  endAt: new Date('2026-10-14T16:00:00.000Z'),
  totalCapacity: 30,
  classistaCapacity: 20,
  status: 'SCHEDULED',
  classPlan: {
    title: 'Puppy Yoga',
    description: 'Bring a mat',
    classType: { categoryId: 'category-1' },
  },
  venue: { name: 'Kadıköy Studio' },
  instructor: { name: 'Ayşe' },
};

describe('ClassSessionsService', () => {
  const prismaMock = { classSession: { findMany: vi.fn() } };
  let service: ClassSessionsService;

  beforeEach(async () => {
    prismaMock.classSession.findMany.mockReset();
    prismaMock.classSession.findMany.mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        ClassSessionsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(ClassSessionsService);
  });

  const queryArgs = () => prismaMock.classSession.findMany.mock.calls[0][0];

  it('scopes the query to the partner through the plan and class type', async () => {
    await service.findByDate(PARTNER_ID, '2026-10-14');

    expect(queryArgs().where.classPlan).toEqual({
      classType: { partnerId: PARTNER_ID },
    });
  });

  it('uses the Istanbul day as [00:00, next 00:00) converted to UTC', async () => {
    await service.findByDate(PARTNER_ID, '2026-10-14');

    // Istanbul is UTC+3: local midnight is 21:00 UTC the evening before.
    expect(queryArgs().where.startAt).toEqual({
      gte: new Date('2026-10-13T21:00:00.000Z'),
      lt: new Date('2026-10-14T21:00:00.000Z'),
    });
  });

  it('rolls the next-day boundary over a month and year end', async () => {
    await service.findByDate(PARTNER_ID, '2026-12-31');

    expect(queryArgs().where.startAt).toEqual({
      gte: new Date('2026-12-30T21:00:00.000Z'),
      lt: new Date('2026-12-31T21:00:00.000Z'),
    });
  });

  it('orders by startAt ascending, then id', async () => {
    await service.findByDate(PARTNER_ID, '2026-10-14');

    expect(queryArgs().orderBy).toEqual([{ startAt: 'asc' }, { id: 'asc' }]);
  });

  it('does not filter by session or plan status', async () => {
    await service.findByDate(PARTNER_ID, '2026-10-14');

    expect(queryArgs().where).not.toHaveProperty('status');
    expect(queryArgs().where.classPlan).not.toHaveProperty('status');
  });

  it('returns an empty array when the day has no sessions', async () => {
    await expect(service.findByDate(PARTNER_ID, '2026-10-14')).resolves.toEqual(
      [],
    );
  });

  it('maps a session to the response contract with ISO timestamps', async () => {
    prismaMock.classSession.findMany.mockResolvedValue([sessionRow]);

    await expect(service.findByDate(PARTNER_ID, '2026-10-14')).resolves.toEqual(
      [
        {
          id: 'session-1',
          classPlanId: 'plan-1',
          venueId: 'venue-1',
          instructorId: 'instructor-1',
          startAt: '2026-10-14T15:00:00.000Z',
          endAt: '2026-10-14T16:00:00.000Z',
          totalCapacity: 30,
          classistaCapacity: 20,
          status: 'SCHEDULED',
          title: 'Puppy Yoga',
          description: 'Bring a mat',
          categoryId: 'category-1',
          venueName: 'Kadıköy Studio',
          instructorName: 'Ayşe',
        },
      ],
    );
  });

  it('returns null instructor fields and description when there are none', async () => {
    prismaMock.classSession.findMany.mockResolvedValue([
      {
        ...sessionRow,
        instructorId: null,
        instructor: null,
        classPlan: { ...sessionRow.classPlan, description: null },
      },
    ]);

    const [session] = await service.findByDate(PARTNER_ID, '2026-10-14');

    expect(session.instructorId).toBeNull();
    expect(session.instructorName).toBeNull();
    expect(session.description).toBeNull();
  });

  it('returns the stored status as is (e.g. CANCELLED)', async () => {
    prismaMock.classSession.findMany.mockResolvedValue([
      { ...sessionRow, status: 'CANCELLED' },
    ]);

    const [session] = await service.findByDate(PARTNER_ID, '2026-10-14');

    expect(session.status).toBe('CANCELLED');
  });
});
