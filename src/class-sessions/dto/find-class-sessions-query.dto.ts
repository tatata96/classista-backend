import { ApiProperty } from '@nestjs/swagger';
import { IsLocalDate } from '../../class-plans/dto/class-plan.validators.js';

export class FindClassSessionsQueryDto {
  @ApiProperty({
    description:
      'The calendar day to list, as a real date in the venue timezone (Europe/Istanbul)',
    example: '2026-10-14',
  })
  @IsLocalDate()
  date: string;
}
