import { Module } from '@nestjs/common';

// plop:imports
import { GetFirmContactsQueryHandler } from './queries/get-firm-contacts.js';
import { GetFirmCustodiansQueryHandler } from './queries/get-firm-custodians.js';
import { GetFirmFilingsQueryHandler } from './queries/get-firm-filings.js';
import { GetFirmFundsQueryHandler } from './queries/get-firm-funds.js';
import { GetFirmMetricsSeriesQueryHandler } from './queries/get-firm-metrics-series.js';
import { GetFirmOfficesQueryHandler } from './queries/get-firm-offices.js';
import { GetFirmProfileQueryHandler } from './queries/get-firm-profile.js';
import { FirmsController } from './firms.controller.js';

@Module({
  controllers: [FirmsController],
  providers: [
    // plop:providers
    GetFirmProfileQueryHandler,
    GetFirmMetricsSeriesQueryHandler,
    GetFirmContactsQueryHandler,
    GetFirmOfficesQueryHandler,
    GetFirmCustodiansQueryHandler,
    GetFirmFundsQueryHandler,
    GetFirmFilingsQueryHandler,
  ],
})
export class FirmsModule {}
