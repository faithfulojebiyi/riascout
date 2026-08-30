import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { AddToListCommand } from './commands/add-to-list.js';
import { CreateListCommand } from './commands/create-list.js';
import {
  AddToListDto,
  AddToListResponseDto,
  CreateListDto,
  CreateListResponseDto,
  GetListsDto,
  GetListsResponseDto,
} from './dto/lists.dto.js';
import { GetListsQuery } from './queries/get-lists.js';

@ApiTags('Lists')
@Controller('lists')
export class ListsController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @ZodResponse({ type: GetListsResponseDto })
  @Post('search')
  async getLists(@Body() dto: GetListsDto) {
    return this.queryBus.execute(new GetListsQuery(dto));
  }

  @ZodResponse({ type: CreateListResponseDto })
  @Post()
  async createList(@Body() dto: CreateListDto) {
    return this.commandBus.execute(new CreateListCommand(dto));
  }

  @ZodResponse({ type: AddToListResponseDto })
  @Post('members')
  async addToList(@Body() dto: AddToListDto) {
    return this.commandBus.execute(new AddToListCommand(dto));
  }
}
