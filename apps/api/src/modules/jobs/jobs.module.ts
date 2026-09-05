import { Module } from '@nestjs/common';

import { JobsController } from './jobs.controller.js';
import { GetJobQueryHandler } from './queries/get-job.js';

@Module({
  controllers: [JobsController],
  providers: [GetJobQueryHandler],
})
export class JobsModule {}
