import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Audit } from '../common/audit/audit.decorator';
import { RolesGuard } from '../common/policy/roles.guard';
import { CharactersService } from './characters.service';
import { CreateCharacterDto } from './dto/create-character.dto';

@Controller('characters')
@UseGuards(RolesGuard)
export class CharactersController {
  constructor(private readonly service: CharactersService) {}

  @Get()
  @Audit('character', 'view')
  list(@Query('search') search?: string) { return this.service.list(search); }

  @Post()
  @Audit('character', 'create')
  create(@Body() dto: CreateCharacterDto) { return this.service.create(dto); }
}
