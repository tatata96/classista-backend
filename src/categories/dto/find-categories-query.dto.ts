import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class FindCategoriesQueryDto {
  @ApiPropertyOptional({
    description: 'Filter categories by name (case-insensitive, partial match)',
    example: 'yoga',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  search?: string;
}
