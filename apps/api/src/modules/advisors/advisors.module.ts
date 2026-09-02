import { Module } from '@nestjs/common';

// plop:imports
import { GetAdvisorProfileQueryHandler } from './queries/get-advisor-profile.js';
import { AdvisorsController } from './advisors.controller.js';

@Module({
  controllers: [AdvisorsController],
  providers: [
    // plop:providers
    GetAdvisorProfileQueryHandler,
  ],
})
export class AdvisorsModule {}
