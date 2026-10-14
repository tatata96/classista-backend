import {
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';
import { RecurrenceType } from '../../generated/prisma/enums.js';
import {
  isValidLocalDate,
  isValidLocalTime,
  localTimeToMinutes,
} from '../zoned-time.js';

const MINUTES_PER_DAY = 24 * 60;

// The decorators below validate one property against another property of the
// same request, which class-validator's built-ins cannot do.
function createDecorator(
  name: string,
  validate: (value: unknown, object: Record<string, unknown>) => boolean,
  message: (args: ValidationArguments) => string,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target, propertyName) => {
    registerDecorator({
      name,
      target: target.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      validator: {
        validate: (value: unknown, args: ValidationArguments) =>
          validate(value, args.object as Record<string, unknown>),
        defaultMessage: message,
      },
    });
  };
}

/** A real calendar date written as 'YYYY-MM-DD', e.g. "2026-10-14". */
export const IsLocalDate = (validationOptions?: ValidationOptions) =>
  createDecorator(
    'isLocalDate',
    (value) => isValidLocalDate(value),
    (args) => `${args.property} must be a real date formatted as YYYY-MM-DD`,
    validationOptions,
  );

/** A 24-hour time written as 'HH:mm', e.g. "18:00". */
export const IsLocalTime = (validationOptions?: ValidationOptions) =>
  createDecorator(
    'isLocalTime',
    (value) => isValidLocalTime(value),
    (args) => `${args.property} must be a 24-hour time formatted as HH:mm`,
    validationOptions,
  );

/** On or after another date property (inclusive end dates). */
export const IsOnOrAfterDate = (
  otherProperty: string,
  validationOptions?: ValidationOptions,
) =>
  createDecorator(
    'isOnOrAfterDate',
    (value, object) => {
      const other = object[otherProperty];
      // A malformed date is reported by IsLocalDate on its own property.
      if (!isValidLocalDate(value) || !isValidLocalDate(other)) return true;
      return value >= other; // 'YYYY-MM-DD' strings sort chronologically
    },
    (args) => `${args.property} must be on or after ${otherProperty}`,
    validationOptions,
  );

/** The session must finish by midnight: start time + duration <= 24:00. */
export const EndsByMidnight = (
  startTimeProperty: string,
  validationOptions?: ValidationOptions,
) =>
  createDecorator(
    'endsByMidnight',
    (value, object) => {
      const startTime = object[startTimeProperty];
      if (!isValidLocalTime(startTime) || typeof value !== 'number')
        return true;
      return localTimeToMinutes(startTime) + value <= MINUTES_PER_DAY;
    },
    (args) =>
      `${args.property} must end the session by midnight (${args.property} plus the start time cannot pass 24:00)`,
    validationOptions,
  );

/** At most the value of another number property (Classista <= total capacity). */
export const IsAtMostProperty = (
  otherProperty: string,
  validationOptions?: ValidationOptions,
) =>
  createDecorator(
    'isAtMostProperty',
    (value, object) => {
      const other = object[otherProperty];
      if (typeof value !== 'number' || typeof other !== 'number') return true;
      return value <= other;
    },
    (args) => `${args.property} cannot exceed ${otherProperty}`,
    validationOptions,
  );

/**
 * Put on recurrenceType. A recurring plan needs at least one weekday; a
 * one-time plan has no weekdays and no end date (its one session is on startDate).
 */
export const ScheduleMatchesRecurrence = (
  validationOptions?: ValidationOptions,
) =>
  createDecorator(
    'scheduleMatchesRecurrence',
    (value, object) => {
      const weekdays = object['weekdays'];
      const hasWeekdays = Array.isArray(weekdays) && weekdays.length > 0;

      if (value === RecurrenceType.RECURRING) return hasWeekdays;
      if (value === RecurrenceType.ONE_TIME) {
        return !hasWeekdays && object['endDate'] === undefined;
      }
      return true; // an invalid enum value is reported by IsEnum
    },
    (args) =>
      (args.value as unknown) === RecurrenceType.RECURRING
        ? 'a RECURRING plan needs at least one weekday'
        : 'a ONE_TIME plan cannot have weekdays or an endDate',
    validationOptions,
  );
