import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateClassPlanDto } from './create-class-plan.dto.js';

const UUID = '33333333-3333-4333-8333-333333333333';

const ONE_TIME = {
  classTypeId: UUID,
  venueId: UUID,
  recurrenceType: 'ONE_TIME',
  startDate: '2026-10-14',
  startTime: '18:00',
  durationMinutes: 60,
  totalCapacity: 30,
  classistaCapacity: 20,
};

const RECURRING = {
  ...ONE_TIME,
  recurrenceType: 'RECURRING',
  weekdays: [1, 3],
};

async function failedProperties(plain: Record<string, unknown>) {
  const errors = await validate(plainToInstance(CreateClassPlanDto, plain));
  return errors.map((error) => error.property);
}

describe('CreateClassPlanDto', () => {
  it('accepts a one-time plan', async () => {
    expect(await failedProperties(ONE_TIME)).toEqual([]);
  });

  it('accepts a recurring plan with and without an end date', async () => {
    expect(await failedProperties(RECURRING)).toEqual([]);
    expect(
      await failedProperties({ ...RECURRING, endDate: '2026-12-31' }),
    ).toEqual([]);
  });

  it('accepts an optional instructor and description', async () => {
    expect(
      await failedProperties({
        ...ONE_TIME,
        instructorId: UUID,
        description: 'Bring a mat.',
      }),
    ).toEqual([]);
  });

  it('turns a blank description into null', async () => {
    const dto = plainToInstance(CreateClassPlanDto, {
      ...ONE_TIME,
      description: '   ',
    });

    expect(dto.description).toBeNull();
    expect(await validate(dto)).toHaveLength(0);
  });

  describe('dates and times', () => {
    it.each([
      '2026-02-30',
      '2026-13-01',
      '14/10/2026',
      '2026-1-4',
      '2026-10-14T00:00:00Z',
    ])('rejects startDate %s', async (startDate) => {
      expect(await failedProperties({ ...ONE_TIME, startDate })).toContain(
        'startDate',
      );
    });

    it.each(['24:00', '9:00', '18:60', '18:00:00', '6pm'])(
      'rejects startTime %s',
      async (startTime) => {
        expect(await failedProperties({ ...ONE_TIME, startTime })).toContain(
          'startTime',
        );
      },
    );

    it('accepts an endDate equal to the startDate (inclusive)', async () => {
      expect(
        await failedProperties({ ...RECURRING, endDate: '2026-10-14' }),
      ).toEqual([]);
    });

    it('rejects an endDate before the startDate', async () => {
      expect(
        await failedProperties({ ...RECURRING, endDate: '2026-10-13' }),
      ).toEqual(['endDate']);
    });
  });

  describe('duration', () => {
    it.each([0, -30, 1.5, '60'])(
      'rejects durationMinutes %s',
      async (durationMinutes) => {
        expect(
          await failedProperties({ ...ONE_TIME, durationMinutes }),
        ).toContain('durationMinutes');
      },
    );

    it('accepts a session ending exactly at midnight', async () => {
      expect(
        await failedProperties({
          ...ONE_TIME,
          startTime: '23:00',
          durationMinutes: 60,
        }),
      ).toEqual([]);
    });

    it('rejects a session ending after midnight', async () => {
      expect(
        await failedProperties({
          ...ONE_TIME,
          startTime: '23:00',
          durationMinutes: 90,
        }),
      ).toEqual(['durationMinutes']);
    });

    it('accepts any positive whole number of minutes, not only presets', async () => {
      expect(
        await failedProperties({ ...ONE_TIME, durationMinutes: 47 }),
      ).toEqual([]);
    });
  });

  describe('capacity', () => {
    it.each([0, -1, 2.5])('rejects totalCapacity %s', async (totalCapacity) => {
      expect(await failedProperties({ ...ONE_TIME, totalCapacity })).toContain(
        'totalCapacity',
      );
    });

    it.each([0, -1, 2.5])(
      'rejects classistaCapacity %s',
      async (classistaCapacity) => {
        expect(
          await failedProperties({ ...ONE_TIME, classistaCapacity }),
        ).toContain('classistaCapacity');
      },
    );

    it('accepts classista capacity equal to total capacity', async () => {
      expect(
        await failedProperties({
          ...ONE_TIME,
          totalCapacity: 20,
          classistaCapacity: 20,
        }),
      ).toEqual([]);
    });

    it('rejects classista capacity above total capacity', async () => {
      expect(
        await failedProperties({
          ...ONE_TIME,
          totalCapacity: 10,
          classistaCapacity: 11,
        }),
      ).toEqual(['classistaCapacity']);
    });
  });

  describe('recurrence', () => {
    it('rejects a recurring plan without weekdays', async () => {
      expect(
        await failedProperties({ ...RECURRING, weekdays: undefined }),
      ).toEqual(['recurrenceType']);
      expect(await failedProperties({ ...RECURRING, weekdays: [] })).toEqual([
        'recurrenceType',
      ]);
    });

    it('rejects a one-time plan with weekdays or an endDate', async () => {
      expect(await failedProperties({ ...ONE_TIME, weekdays: [1] })).toEqual([
        'recurrenceType',
      ]);
      expect(
        await failedProperties({ ...ONE_TIME, endDate: '2026-12-31' }),
      ).toEqual(['recurrenceType']);
    });

    it('accepts a one-time plan with an empty weekdays array', async () => {
      expect(await failedProperties({ ...ONE_TIME, weekdays: [] })).toEqual([]);
    });

    it.each([[[0]], [[8]], [[1, 1]], [[1.5]], [['1']]])(
      'rejects weekdays %j',
      async (weekdays) => {
        expect(await failedProperties({ ...RECURRING, weekdays })).toContain(
          'weekdays',
        );
      },
    );

    it('accepts Sunday as 7', async () => {
      expect(await failedProperties({ ...RECURRING, weekdays: [7] })).toEqual(
        [],
      );
    });

    it('rejects an unknown recurrenceType', async () => {
      expect(
        await failedProperties({ ...ONE_TIME, recurrenceType: 'WEEKLY' }),
      ).toEqual(['recurrenceType']);
    });
  });

  describe('through the global validation pipe', () => {
    // Same options as configureApp().
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    it.each(['partnerId', 'title', 'status', 'timezone'])(
      'rejects a client-provided %s with 400',
      async (field) => {
        await expect(
          pipe.transform(
            { ...ONE_TIME, [field]: 'x' },
            { type: 'body', metatype: CreateClassPlanDto },
          ),
        ).rejects.toBeInstanceOf(BadRequestException);
      },
    );
  });
});
