import { Module } from '@nestjs/common';

// plop:imports
import { GetEntityRecordsQueryHandler } from './queries/get-entity-records.js'
import { EntitiesController } from './entities.controller.js';

@Module({
  controllers: [EntitiesController],
  providers: [
    // plop:providers
    GetEntityRecordsQueryHandler,
  ],
})
export class EntitiesModule {}
