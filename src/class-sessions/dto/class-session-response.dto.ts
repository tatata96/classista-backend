import { ApiProperty } from '@nestjs/swagger';
import { SessionStatus } from '../../generated/prisma/enums.js';

// Timestamps are ISO 8601 strings in UTC (e.g. 2026-10-14T15:00:00.000Z).
export class ClassSessionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  classPlanId: string;

  @ApiProperty()
  venueId: string;

  @ApiProperty({ type: String, nullable: true })
  instructorId: string | null;

  @ApiProperty({ example: '2026-10-14T15:00:00.000Z' })
  startAt: string;

  @ApiProperty({ example: '2026-10-14T16:00:00.000Z' })
  endAt: string;

  @ApiProperty({ example: 30 })
  totalCapacity: number;

  @ApiProperty({ example: 20 })
  classistaCapacity: number;

  @ApiProperty({
    enum: SessionStatus,
    description:
      'As stored. Cancelled and completed sessions are included; the client decides what to show.',
  })
  status: SessionStatus;

  @ApiProperty({ description: "The class plan's title" })
  title: string;

  @ApiProperty({ type: String, nullable: true })
  description: string | null;

  @ApiProperty({ description: "The class type's category" })
  categoryId: string;

  @ApiProperty()
  venueName: string;

  @ApiProperty({ type: String, nullable: true })
  instructorName: string | null;
}
