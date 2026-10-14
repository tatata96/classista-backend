// Date and time helpers for Class Plans. A plan stores local wall-clock values
// (a date and a start time at the venue); a session stores an exact instant.
// Everything here uses Intl and plain Date maths, so no date library is needed.
//
// Dates are plain 'YYYY-MM-DD' strings and times are 'HH:mm' strings, both
// meaning "as shown on the venue's wall clock". The file has four groups:
//   1. Checking text: is it a real date / a valid time?
//   2. Database columns: converting that text to and from Prisma's Date values.
//   3. Wall clock <-> instant: using the venue's timezone.
//   4. Calendar maths: adding days, finding the ISO weekday.
//
// Daylight saving edge cases (a local time that does not exist or happens
// twice) are NOT handled: MVP venues are all Europe/Istanbul, which has no
// daylight saving (spec 0003).

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** True for a real calendar date written as 'YYYY-MM-DD' ('2026-02-30' is false). */
export function isValidLocalDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return false;

  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  // Date.UTC rolls an impossible date over (Feb 30 -> Mar 2), so compare it back.
  return formatLocalDate(Date.UTC(year, month - 1, day)) === value;
}

/** True for a 24-hour time written as 'HH:mm'. */
export function isValidLocalTime(value: unknown): value is string {
  return typeof value === 'string' && LOCAL_TIME_PATTERN.test(value);
}

/** Minutes since local midnight for an 'HH:mm' time. */
export function localTimeToMinutes(localTime: string): number {
  const [hour, minute] = parseLocalTime(localTime);
  return hour * 60 + minute;
}

function parseLocalDate(localDate: string): [number, number, number] {
  if (!isValidLocalDate(localDate)) {
    throw new Error(`Invalid local date: ${localDate}`);
  }
  const [year, month, day] = localDate.split('-').map(Number);
  return [year, month, day];
}

function parseLocalTime(localTime: string): [number, number] {
  const match = LOCAL_TIME_PATTERN.exec(localTime);
  if (!match) {
    throw new Error(`Invalid local time: ${localTime}`);
  }
  return [Number(match[1]), Number(match[2])];
}

function formatLocalDate(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10);
}

// How far the timezone's wall clock is ahead of UTC at this instant, in ms.
function getOffsetMs(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instantMs));

  const value = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value);

  const wallClockAsUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );

  // Drop sub-second precision so it does not leak into the offset.
  return wallClockAsUtc - Math.floor(instantMs / 1000) * 1000;
}

// Prisma hands a @db.Date column back as a Date at UTC midnight, and a
// @db.Time column as a Date on 1970-01-01. These four functions convert between
// those Date values and the 'YYYY-MM-DD' / 'HH:mm' text used in requests.

/** 'YYYY-MM-DD' to the Date Prisma stores in a @db.Date column. */
export function localDateToDbDate(localDate: string): Date {
  parseLocalDate(localDate); // throws for anything that is not a real date
  return new Date(`${localDate}T00:00:00.000Z`);
}

/** 'HH:mm' to the Date Prisma stores in a @db.Time column. */
export function localTimeToDbTime(localTime: string): Date {
  parseLocalTime(localTime); // throws for anything that is not a time
  return new Date(`1970-01-01T${localTime}:00.000Z`);
}

/** A @db.Date column value back to 'YYYY-MM-DD'. */
export function dbDateToLocalDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** A @db.Time column value back to 'HH:mm'. */
export function dbTimeToLocalTime(time: Date): string {
  return time.toISOString().slice(11, 16);
}

/** The exact instant at which the venue's wall clock shows this date and time. */
export function zonedDateTimeToInstant(
  localDate: string,
  localTime: string,
  timeZone: string,
): Date {
  const [year, month, day] = parseLocalDate(localDate);
  const [hour, minute] = parseLocalTime(localTime);

  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  // The offset depends on the instant we are looking for, so refine the guess once.
  const firstGuess = wallClockAsUtc - getOffsetMs(wallClockAsUtc, timeZone);
  return new Date(wallClockAsUtc - getOffsetMs(firstGuess, timeZone));
}

/** The venue's calendar date at this instant, as 'YYYY-MM-DD'. */
export function instantToLocalDate(instant: Date, timeZone: string): string {
  const wallClockAsUtc =
    instant.getTime() + getOffsetMs(instant.getTime(), timeZone);
  return formatLocalDate(wallClockAsUtc);
}

/** Calendar arithmetic on a local date; negative days go backwards. */
export function addDaysToLocalDate(localDate: string, days: number): string {
  const [year, month, day] = parseLocalDate(localDate);
  return formatLocalDate(Date.UTC(year, month - 1, day) + days * DAY_MS);
}

/** ISO weekday of a local date: 1 = Monday through 7 = Sunday. */
export function getIsoWeekday(localDate: string): number {
  const [year, month, day] = parseLocalDate(localDate);
  const jsWeekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = Sunday
  return jsWeekday === 0 ? 7 : jsWeekday;
}

/** The instant `minutes` after `instant`. Used for endAt = startAt + duration. */
export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * MINUTE_MS);
}
