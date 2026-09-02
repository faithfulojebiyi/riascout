import { Body, Controller, Post } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import {
  GetAdvisorProfileDto,
  GetAdvisorProfileResponseDto,
} from './dto/advisors.dto.js';
import { GetAdvisorProfileQuery } from './queries/get-advisor-profile.js';

@ApiTags('Advisors')
@Controller('advisors')
export class AdvisorsController {
  constructor(private readonly queryBus: QueryBus) {}

  @ZodResponse({ type: GetAdvisorProfileResponseDto })
  @Post('profile')
  async getAdvisorProfile(@Body() dto: GetAdvisorProfileDto) {
    return this.queryBus.execute(new GetAdvisorProfileQuery(dto));
  }
}
