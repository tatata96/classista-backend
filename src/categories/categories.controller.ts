import { Controller, Get } from '@nestjs/common';
import { CategoriesService } from './categories.service.js';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CategoryResponseDto } from './dto/category-response.dto.js';

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
  findAll() {
    return this.categoriesService.findAll();
  }
}
