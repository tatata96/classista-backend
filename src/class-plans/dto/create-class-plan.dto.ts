import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RecurrenceType } from '../../generated/prisma/enums.js';
import {
  EndsByMidnight,
  IsAtMostProperty,
  IsLocalDate,
  IsLocalTime,
  IsOnOrAfterDate,
  ScheduleMatchesRecurrence,
} from './class-plan.validators.js';

// No partnerId, title, status, or timezone: the partner comes from the
// authenticated user, the title is copied from the Class Type's name, a new
// plan is always ACTIVE, and the venue's timezone is read from the venue.
// Dates and times are the venue's wall clock (see zoned-time.ts).
export class CreateClassPlanDto {
  @ApiProperty({ description: 'An active Class Type owned by the partner' })
  @IsUUID()
  classTypeId: string;

  @ApiProperty({ description: 'An active venue owned by the partner' })
  @IsUUID()
  venueId: string;

  @ApiPropertyOptional({
    description: 'An active instructor owned by the partner',
  })
  @IsOptional()
  @IsUUID()
  instructorId?: string;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  // Trim first, then store blank text as null, like Class Type descriptions.
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    return value.trim() === '' ? null : value.trim();
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiProperty({
    enum: RecurrenceType,
    description:
      'RECURRING needs weekdays. ONE_TIME has no weekdays or endDate: its one session is on startDate.',
  })
  @IsEnum(RecurrenceType)
  @ScheduleMatchesRecurrence()
  recurrenceType: RecurrenceType;

  @ApiProperty({
    example: '2026-10-14',
    description: 'First possible date, as YYYY-MM-DD (venue local date)',
  })
  @IsLocalDate()
  startDate: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description:
      'Last possible date, inclusive. Recurring plans only; omit to run open-ended.',
  })
  @IsOptional()
  @IsLocalDate()
  @IsOnOrAfterDate('startDate')
  endDate?: string;

  @ApiPropertyOptional({
    example: [1, 3],
    description:
      'ISO weekdays: 1 = Monday through 7 = Sunday. Recurring plans only.',
    minimum: 1,
    maximum: 7,
    isArray: true,
    type: Number,
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  weekdays?: number[];

  @ApiProperty({
    example: '18:00',
    description: 'Start time as 24-hour HH:mm (venue local time)',
  })
  @IsLocalTime()
  startTime: string;

  @ApiProperty({
    example: 60,
    minimum: 1,
    description:
      'Length in whole minutes. The session must end by midnight (ending exactly at 00:00 is allowed).',
  })
  @IsInt()
  @Min(1)
  @EndsByMidnight('startTime')
  durationMinutes: number;

  @ApiProperty({
    example: 30,
    minimum: 1,
    description:
      'Maximum participants in the whole class, including bookings made outside Classista',
  })
  @IsInt()
  @Min(1)
  totalCapacity: number;

  @ApiProperty({
    example: 20,
    minimum: 1,
    description:
      'Maximum bookings accepted through Classista. Cannot exceed totalCapacity.',
  })
  @IsInt()
  @Min(1)
  @IsAtMostProperty('totalCapacity')
  classistaCapacity: number;
}
