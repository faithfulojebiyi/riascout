import { Body, Controller, Post } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import {
  GetFirmFlowsDto,
  GetFirmFlowsResponseDto,
  GetFirmMovesDto,
  GetFirmMovesResponseDto,
} from './dto/movement.dto.js';
import { GetFirmFlowsQuery } from './queries/get-firm-flows.js';
import { GetFirmMovesQuery } from './queries/get-firm-moves.js';

@ApiTags('Movement')
@Controller('movement')
export class MovementController {
  constructor(private readonly queryBus: QueryBus) {}

  @ZodResponse({ type: GetFirmFlowsResponseDto })
  @Post('firm-flows')
  async getFirmFlows(@Body() dto: GetFirmFlowsDto) {
    return this.queryBus.execute(new GetFirmFlowsQuery(dto));
  }

  @ZodResponse({ type: GetFirmMovesResponseDto })
  @Post('firm-moves')
  async getFirmMoves(@Body() dto: GetFirmMovesDto) {
    return this.queryBus.execute(new GetFirmMovesQuery(dto));
  }
}
