import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../generated/prisma/enums.js';
import { MePartnerDto } from './me-partner.dto.js';

export class MeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, nullable: true })
  email: string | null;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty({
    type: MePartnerDto,
    nullable: true,
    description:
      'The partner this user belongs to, or null for a regular customer. ' +
      'The MVP intends one partner per user, but the database does not enforce it yet: ' +
      'if a user has several memberships, the oldest one is returned. ' +
      'Use it to display the studio. It does not grant access: the backend re-checks every partner request.',
  })
  partner: MePartnerDto | null;
}
