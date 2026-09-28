import { ApiProperty } from '@nestjs/swagger';

export class PartnerBusinessProfileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, nullable: true })
  description: string | null;

  @ApiProperty({ type: String, nullable: true })
  phone: string | null;

  @ApiProperty({ type: String, nullable: true })
  websiteUrl: string | null;

  @ApiProperty({ type: String, nullable: true })
  facebookUrl: string | null;

  @ApiProperty({ type: String, nullable: true })
  instagramHandle: string | null;

  @ApiProperty({ type: String, nullable: true })
  xHandle: string | null;

  @ApiProperty({ type: String, nullable: true })
  tiktokHandle: string | null;

  @ApiProperty({ description: 'Minutes before a class starts that bookings close' })
  bookingCutoffMinutes: number;
}
