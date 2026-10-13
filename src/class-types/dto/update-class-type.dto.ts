import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateClassTypeDto {
  @ApiPropertyOptional({ example: 'Puppy Yoga', minLength: 1, maxLength: 150 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  // Skip validation only when the field is absent; null still fails below.
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({
    description: 'A leaf category (one with no subcategories)',
  })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    maxLength: 2000,
    nullable: true,
    description: 'Blank text or null clears the description',
  })
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    return value.trim() === '' ? null : value.trim();
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}
