import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../generated/prisma/enums.js';

export class MeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, nullable: true })
  email: string | null;

  @ApiProperty({ enum: UserRole })
  role: UserRole;
}
