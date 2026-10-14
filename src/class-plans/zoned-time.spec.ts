import {
  addDaysToLocalDate,
  addMinutes,
  dbDateToLocalDate,
  dbTimeToLocalTime,
  getIsoWeekday,
  instantToLocalDate,
  isValidLocalDate,
  isValidLocalTime,
  localDateToDbDate,
  localTimeToDbTime,
  localTimeToMinutes,
  zonedDateTimeToInstant,
} from './zoned-time.js';

const ISTANBUL = 'Europe/Istanbul';

describe('zonedDateTimeToInstant', () => {
  it('converts an Istanbul wall-clock time (UTC+3) to the exact instant', () => {
    const instant = zonedDateTimeToInstant('2026-10-14', '18:00', ISTANBUL);

    expect(instant.toISOString()).toBe('2026-10-14T15:00:00.000Z');
  });

  it('crosses into the previous UTC day for early-morning local times', () => {
    const instant = zonedDateTimeToInstant('2026-10-14', '01:30', ISTANBUL);

    expect(instant.toISOString()).toBe('2026-10-13T22:30:00.000Z');
  });

  it('reads the offset from the timezone instead of assuming +3', () => {
    // New York is UTC-4 in July (daylight saving) and UTC-5 in January.
    expect(
      zonedDateTimeToInstant(
        '2026-07-01',
        '12:00',
        'America/New_York',
      ).toISOString(),
    ).toBe('2026-07-01T16:00:00.000Z');
    expect(
      zonedDateTimeToInstant(
        '2026-01-15',
        '12:00',
        'America/New_York',
      ).toISOString(),
    ).toBe('2026-01-15T17:00:00.000Z');
  });

  it('rejects malformed dates and times', () => {
    expect(() =>
      zonedDateTimeToInstant('14/10/2026', '18:00', ISTANBUL),
    ).toThrow('Invalid local date');
    expect(() =>
      zonedDateTimeToInstant('2026-10-14', '24:00', ISTANBUL),
    ).toThrow('Invalid local time');
    expect(() =>
      zonedDateTimeToInstant('2026-10-14', '9:00', ISTANBUL),
    ).toThrow('Invalid local time');
  });
});

describe('endAt = startAt + duration', () => {
  it('lands exactly on the next midnight for a 23:00 + 60 minute class', () => {
    const startAt = zonedDateTimeToInstant('2026-10-14', '23:00', ISTANBUL);
    const endAt = addMinutes(startAt, 60);

    expect(endAt.toISOString()).toBe('2026-10-14T21:00:00.000Z');
    expect(instantToLocalDate(endAt, ISTANBUL)).toBe('2026-10-15');
    expect(endAt).toEqual(
      zonedDateTimeToInstant('2026-10-15', '00:00', ISTANBUL),
    );
  });
});

describe('instantToLocalDate', () => {
  it('returns the venue date, not the UTC date', () => {
    // 21:30Z is already 00:30 the next day in Istanbul.
    expect(instantToLocalDate(new Date('2026-10-14T21:30:00Z'), ISTANBUL)).toBe(
      '2026-10-15',
    );
    expect(instantToLocalDate(new Date('2026-10-14T20:59:59Z'), ISTANBUL)).toBe(
      '2026-10-14',
    );
  });
});

describe('addDaysToLocalDate', () => {
  it('moves across month and year boundaries and backwards', () => {
    expect(addDaysToLocalDate('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDaysToLocalDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToLocalDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysToLocalDate('2026-10-14', 0)).toBe('2026-10-14');
  });
});

describe('getIsoWeekday', () => {
  it('numbers Monday as 1 and Sunday as 7', () => {
    expect(getIsoWeekday('2026-10-12')).toBe(1); // Monday
    expect(getIsoWeekday('2026-10-14')).toBe(3); // Wednesday
    expect(getIsoWeekday('2026-10-18')).toBe(7); // Sunday
  });
});

describe('isValidLocalDate', () => {
  it('accepts real calendar dates, including leap days', () => {
    expect(isValidLocalDate('2026-10-14')).toBe(true);
    expect(isValidLocalDate('2028-02-29')).toBe(true);
  });

  it('rejects impossible dates and other formats', () => {
    expect(isValidLocalDate('2026-02-30')).toBe(false);
    expect(isValidLocalDate('2027-02-29')).toBe(false);
    expect(isValidLocalDate('2026-04-31')).toBe(false);
    expect(isValidLocalDate('2026-13-01')).toBe(false);
    expect(isValidLocalDate('2026-1-4')).toBe(false);
    expect(isValidLocalDate('2026-10-14T00:00:00Z')).toBe(false);
    expect(isValidLocalDate(20261014)).toBe(false);
  });
});

describe('isValidLocalTime and localTimeToMinutes', () => {
  it('accepts 00:00 through 23:59 only', () => {
    expect(isValidLocalTime('00:00')).toBe(true);
    expect(isValidLocalTime('23:59')).toBe(true);
    expect(isValidLocalTime('24:00')).toBe(false);
    expect(isValidLocalTime('9:00')).toBe(false);
  });

  it('counts minutes since midnight', () => {
    expect(localTimeToMinutes('00:00')).toBe(0);
    expect(localTimeToMinutes('18:30')).toBe(1110);
  });
});

describe('database date and time columns', () => {
  it('round-trips a date through the @db.Date representation', () => {
    const column = localDateToDbDate('2026-10-14');

    expect(column.toISOString()).toBe('2026-10-14T00:00:00.000Z');
    expect(dbDateToLocalDate(column)).toBe('2026-10-14');
  });

  it('round-trips a time through the @db.Time representation', () => {
    const column = localTimeToDbTime('18:30');

    expect(column.toISOString()).toBe('1970-01-01T18:30:00.000Z');
    expect(dbTimeToLocalTime(column)).toBe('18:30');
  });

  it('rejects text that is not a real date or time', () => {
    expect(() => localDateToDbDate('2026-02-30')).toThrow('Invalid local date');
    expect(() => localTimeToDbTime('25:00')).toThrow('Invalid local time');
  });
});
