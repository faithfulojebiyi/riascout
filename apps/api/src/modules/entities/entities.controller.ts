import { Body, Controller, Get, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { CreateEntityRecordCommand } from './commands/create-entity-record.js';
import { MoveViewFieldCommand } from './commands/move-view-field.js';
import { UpdateRecordValuesCommand } from './commands/update-record-values.js';
import { UpdateViewFieldCommand } from './commands/update-view-field.js';
import { UpdateViewSortCommand } from './commands/update-view-sort.js';
import {
  CreateEntityRecordDto,
  CreateEntityRecordResponseDto,
  GetEntitiesDto,
  GetEntitiesResponseDto,
  GetEntityRecordsDto,
  GetEntityRecordsResponseDto,
  MoveViewFieldDto,
  MoveViewFieldResponseDto,
  UpdateRecordValuesDto,
  UpdateRecordValuesResponseDto,
  UpdateViewFieldDto,
  UpdateViewSortDto,
} from './dto/entities.dto.js';
import { GetEntitiesQuery } from './queries/get-entities.js';
import { GetEntityRecordsQuery } from './queries/get-entity-records.js';

@ApiTags('Entities')
@Controller('entities')
export class EntitiesController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @ZodResponse({ type: GetEntitiesResponseDto })
  @Get()
  async getEntities() {
    return this.queryBus.execute(new GetEntitiesQuery({} as GetEntitiesDto));
  }

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

  @Post('update-view-field')
  async updateViewField(@Body() dto: UpdateViewFieldDto) {
    await this.commandBus.execute(new UpdateViewFieldCommand(dto));
  }

  @ZodResponse({ type: MoveViewFieldResponseDto })
  @Post('move-view-field')
  async moveViewField(@Body() dto: MoveViewFieldDto) {
    return this.commandBus.execute(new MoveViewFieldCommand(dto));
  }

  @Post('update-view-sort')
  async updateViewSort(@Body() dto: UpdateViewSortDto) {
    await this.commandBus.execute(new UpdateViewSortCommand(dto));
  }
}
