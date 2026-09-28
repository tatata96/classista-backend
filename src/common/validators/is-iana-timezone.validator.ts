import { registerDecorator, ValidationOptions } from 'class-validator';

/** True when Intl recognises the value as a timezone, e.g. "Europe/Istanbul". */
export function isIanaTimezone(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function IsIanaTimezone(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target, propertyName) => {
    registerDecorator({
      name: 'isIanaTimezone',
      target: target.constructor,
      propertyName: propertyName as string,
      options: {
        message: `${String(propertyName)} must be a valid IANA timezone (e.g. Europe/Istanbul)`,
        ...validationOptions,
      },
      validator: { validate: isIanaTimezone },
    });
  };
}
