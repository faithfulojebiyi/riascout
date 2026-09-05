import { Body, Controller, Post } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { GetJobDto, GetJobResponseDto } from './dto/jobs.dto.js';
import { GetJobQuery } from './queries/get-job.js';

@ApiTags('Jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly queryBus: QueryBus) {}

  @ZodResponse({ type: GetJobResponseDto })
  @Post('get')
  async getJob(@Body() dto: GetJobDto) {
    return this.queryBus.execute(new GetJobQuery(dto));
  }
}
