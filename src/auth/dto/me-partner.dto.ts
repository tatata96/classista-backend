import { ApiProperty } from '@nestjs/swagger';
import { PartnerRole, PartnerStatus } from '../../generated/prisma/enums.js';

export class MePartnerDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({
    enum: PartnerStatus,
    description:
      'Returned even when INACTIVE so the dashboard can show that state; ' +
      'partner endpoints refuse an inactive partner with 403.',
  })
  status: PartnerStatus;

  @ApiProperty({ enum: PartnerRole, description: "The user's role at this partner." })
  role: PartnerRole;
}
