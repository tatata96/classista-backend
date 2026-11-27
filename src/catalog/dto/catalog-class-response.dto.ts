import { ApiProperty } from '@nestjs/swagger';

// Public responses (spec 0004). Visitors are anonymous, so a field appears here
// only when it is meant for everyone.
export class CatalogCategoryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

export class CatalogBusinessRefDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

export class CatalogClassListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, nullable: true })
  description: string | null;

  @ApiProperty({ type: CatalogCategoryDto })
  category: CatalogCategoryDto;

  @ApiProperty({ type: CatalogBusinessRefDto })
  business: CatalogBusinessRefDto;
}

export class CatalogClassPageDto {
  @ApiProperty({ type: [CatalogClassListItemDto] })
  items: CatalogClassListItemDto[];

  @ApiProperty({ description: 'How many classes match across all pages' })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
