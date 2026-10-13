import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class FindClassTypesQueryDto {
  @ApiPropertyOptional({
    description: 'true = active types (default), false = archived types',
    type: Boolean,
    default: true,
  })
  // Query values arrive as strings. @Type(() => Boolean) would turn "false"
  // into true (any non-empty string is truthy), so map the two literals by
  // hand and leave anything else for @IsBoolean to reject with a 400.
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
