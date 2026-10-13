import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

// No partnerId, no isActive: the partner comes from the authenticated user,
// and a new class type is always active. Images are not managed yet.
export class CreateClassTypeDto {
  @ApiProperty({ example: 'Puppy Yoga', minLength: 1, maxLength: 150 })
  // Trim first so "   " becomes "" and fails @IsNotEmpty.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({
    description: 'A leaf category (one with no subcategories)',
  })
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  // Trim first, then store blank text as null ("no description") so the
  // database never holds "" or "   ". The length check runs on the trimmed text.
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    return value.trim() === '' ? null : value.trim();
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}
