import { ApiProperty } from '@nestjs/swagger';
import { PartnerStatus } from '../../generated/prisma/enums.js';

export class PartnerResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, nullable: true })
  description: string | null;

  @ApiProperty({ enum: PartnerStatus })
  status: PartnerStatus;
}
