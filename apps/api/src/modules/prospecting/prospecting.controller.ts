import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import {
  SearchAdvisorsDto,
  SearchAdvisorsResponseDto,
} from './dto/prospecting.dto.js';
import { SearchAdvisorsQuery } from './queries/search-advisors.js';

@ApiTags('Prospecting')
@Controller('prospecting')
export class ProspectingController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @ZodResponse({ type: SearchAdvisorsResponseDto })
  @Post('search-advisors')
  async searchAdvisors(@Body() dto: SearchAdvisorsDto) {
    return this.queryBus.execute(new SearchAdvisorsQuery(dto));
  }
}
