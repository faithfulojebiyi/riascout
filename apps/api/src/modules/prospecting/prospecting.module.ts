import { Module } from '@nestjs/common';

// plop:imports
import { SearchAdvisorsQueryHandler } from './queries/search-advisors.js';
import { ProspectingController } from './prospecting.controller.js';

@Module({
  controllers: [ProspectingController],
  providers: [
    // plop:providers
    SearchAdvisorsQueryHandler,
  ],
})
export class ProspectingModule {}
