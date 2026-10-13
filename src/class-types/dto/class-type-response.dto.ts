import { ApiProperty } from '@nestjs/swagger';

export class ClassTypeCategoryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

export class ClassTypeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, nullable: true })
  description: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  categoryId: string;

  @ApiProperty({ type: ClassTypeCategoryDto })
  category: ClassTypeCategoryDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
