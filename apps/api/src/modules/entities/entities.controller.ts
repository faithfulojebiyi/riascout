import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { CreateEntityRecordCommand } from './commands/create-entity-record.js';
import { UpdateRecordValuesCommand } from './commands/update-record-values.js';
import {
  CreateEntityRecordDto,
  CreateEntityRecordResponseDto,
  GetEntityRecordsDto,
  GetEntityRecordsResponseDto,
  UpdateRecordValuesDto,
  UpdateRecordValuesResponseDto,
} from './dto/entities.dto.js';
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

  @ZodResponse({ type: CreateEntityRecordResponseDto })
  @Post('create-entity-record')
  async createEntityRecord(@Body() dto: CreateEntityRecordDto) {
    return this.commandBus.execute(new CreateEntityRecordCommand(dto));
  }

  @ZodResponse({ type: UpdateRecordValuesResponseDto })
  @Post('update-record-values')
  async updateRecordValues(@Body() dto: UpdateRecordValuesDto) {
    return this.commandBus.execute(new UpdateRecordValuesCommand(dto));
  }
}
