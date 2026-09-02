import { Body, Controller, Post } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import {
  GetFirmContactsDto,
  GetFirmContactsResponseDto,
  GetFirmCustodiansDto,
  GetFirmCustodiansResponseDto,
  GetFirmFilingsDto,
  GetFirmFilingsResponseDto,
  GetFirmFundsDto,
  GetFirmFundsResponseDto,
  GetFirmMetricsSeriesDto,
  GetFirmMetricsSeriesResponseDto,
  GetFirmOfficesDto,
  GetFirmOfficesResponseDto,
  GetFirmProfileDto,
  GetFirmProfileResponseDto,
} from './dto/firms.dto.js';
import { GetFirmContactsQuery } from './queries/get-firm-contacts.js';
import { GetFirmCustodiansQuery } from './queries/get-firm-custodians.js';
import { GetFirmFilingsQuery } from './queries/get-firm-filings.js';
import { GetFirmFundsQuery } from './queries/get-firm-funds.js';
import { GetFirmMetricsSeriesQuery } from './queries/get-firm-metrics-series.js';
import { GetFirmOfficesQuery } from './queries/get-firm-offices.js';
import { GetFirmProfileQuery } from './queries/get-firm-profile.js';

@ApiTags('Firms')
@Controller('firms')
export class FirmsController {
  constructor(private readonly queryBus: QueryBus) {}

  @ZodResponse({ type: GetFirmProfileResponseDto })
  @Post('profile')
  async getFirmProfile(@Body() dto: GetFirmProfileDto) {
    return this.queryBus.execute(new GetFirmProfileQuery(dto));
  }

  @ZodResponse({ type: GetFirmMetricsSeriesResponseDto })
  @Post('metrics-series')
  async getFirmMetricsSeries(@Body() dto: GetFirmMetricsSeriesDto) {
    return this.queryBus.execute(new GetFirmMetricsSeriesQuery(dto));
  }

  @ZodResponse({ type: GetFirmContactsResponseDto })
  @Post('contacts')
  async getFirmContacts(@Body() dto: GetFirmContactsDto) {
    return this.queryBus.execute(new GetFirmContactsQuery(dto));
  }

  @ZodResponse({ type: GetFirmOfficesResponseDto })
  @Post('offices')
  async getFirmOffices(@Body() dto: GetFirmOfficesDto) {
    return this.queryBus.execute(new GetFirmOfficesQuery(dto));
  }

  @ZodResponse({ type: GetFirmCustodiansResponseDto })
  @Post('custodians')
  async getFirmCustodians(@Body() dto: GetFirmCustodiansDto) {
    return this.queryBus.execute(new GetFirmCustodiansQuery(dto));
  }

  @ZodResponse({ type: GetFirmFundsResponseDto })
  @Post('funds')
  async getFirmFunds(@Body() dto: GetFirmFundsDto) {
    return this.queryBus.execute(new GetFirmFundsQuery(dto));
  }

  @ZodResponse({ type: GetFirmFilingsResponseDto })
  @Post('filings')
  async getFirmFilings(@Body() dto: GetFirmFilingsDto) {
    return this.queryBus.execute(new GetFirmFilingsQuery(dto));
  }
}
