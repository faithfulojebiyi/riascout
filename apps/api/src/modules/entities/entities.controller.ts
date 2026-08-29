import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { GetEntityRecordsDto, GetEntityRecordsResponseDto } from './dto/entities.dto.js';
import { GetEntityRecordsQuery } from './queries/get-entity-records.js';

@ApiTags('Entities')
@Controller('entities')
export class EntitiesController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @ZodResponse({ type: GetEntityRecordsResponseDto })
  @Post('get-entity-records')
  async getEntityRecords(@Body() dto: GetEntityRecordsDto) {
    return this.queryBus.execute(new GetEntityRecordsQuery(dto));
  }
}
