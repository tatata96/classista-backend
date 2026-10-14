import { ApiProperty } from '@nestjs/swagger';
import {
  ClassPlanStatus,
  RecurrenceType,
} from '../../generated/prisma/enums.js';

// Same formats as the request: dates are YYYY-MM-DD, times are HH:mm
export class ClassPlanResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  classTypeId: string;

  @ApiProperty()
  venueId: string;

  @ApiProperty({ type: String, nullable: true })
  instructorId: string | null;

  @ApiProperty({
    description: "Copied from the Class Type's name when the plan was created",
  })
  title: string;

  @ApiProperty({ type: String, nullable: true })
  description: string | null;

  @ApiProperty({ enum: RecurrenceType })
  recurrenceType: RecurrenceType;

  @ApiProperty({ example: '2026-10-14' })
  startDate: string;

  @ApiProperty({ type: String, nullable: true, example: '2026-12-31' })
  endDate: string | null;

  @ApiProperty({
    type: Number,
    isArray: true,
    description:
      'ISO weekdays: 1 = Monday through 7 = Sunday. Empty for ONE_TIME.',
  })
  weekdays: number[];

  @ApiProperty({ example: '18:00' })
  startTime: string;

  @ApiProperty({ example: 60 })
  durationMinutes: number;

  @ApiProperty({ example: 30 })
  totalCapacity: number;

  @ApiProperty({ example: 20 })
  classistaCapacity: number;

  @ApiProperty({ enum: ClassPlanStatus })
  status: ClassPlanStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
