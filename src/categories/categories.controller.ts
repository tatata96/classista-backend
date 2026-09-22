import { Controller, Get, Query } from '@nestjs/common';
import { CategoriesService } from './categories.service.js';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CategoryResponseDto } from './dto/category-response.dto.js';
import { FindCategoriesQueryDto } from './dto/find-categories-query.dto.js';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOkResponse({
    description: 'Returns categories with their subcategories',
    type: CategoryResponseDto,
    isArray: true,
  })
  @ApiQuery({ name: 'search', required: false, description: 'Filter categories by name' })
  findAll(@Query() query: FindCategoriesQueryDto) {
    return this.categoriesService.findAll(query.search);
  }
}
