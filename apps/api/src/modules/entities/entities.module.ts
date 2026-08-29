import { Module } from '@nestjs/common';

// plop:imports
import { GetEntitiesQueryHandler } from './queries/get-entities.js'
import { CreateEntityRecordCommandHandler } from './commands/create-entity-record.js'
import { UpdateRecordValuesCommandHandler } from './commands/update-record-values.js'
import { GetEntityRecordsQueryHandler } from './queries/get-entity-records.js'
import { EntitiesController } from './entities.controller.js';

@Module({
  controllers: [EntitiesController],
  providers: [
    // plop:providers
    GetEntitiesQueryHandler,
    CreateEntityRecordCommandHandler,
    UpdateRecordValuesCommandHandler,
    GetEntityRecordsQueryHandler,
  ],
})
export class EntitiesModule {}
