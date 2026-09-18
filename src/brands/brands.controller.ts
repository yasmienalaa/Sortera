import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Audit } from '../common/audit/audit.decorator';
import { RolesGuard } from '../common/policy/roles.guard';
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';

@Controller('brands')
@UseGuards(RolesGuard)
export class BrandsController {
  constructor(private readonly service: BrandsService) {}

  @Get()
  @Audit('brand', 'view')
  list(@Query('search') search?: string) { return this.service.list(search); }

  @Post()
  @Audit('brand', 'create')
  create(@Body() dto: CreateBrandDto) { return this.service.create(dto); }
}
