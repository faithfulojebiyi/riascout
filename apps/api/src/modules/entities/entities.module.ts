import { Module } from '@nestjs/common';

// plop:imports
import { GetEntitiesQueryHandler } from './queries/get-entities.js';
import { CreateEntityRecordCommandHandler } from './commands/create-entity-record.js';
import { UpdateRecordValuesCommandHandler } from './commands/update-record-values.js';
import { MoveViewFieldCommandHandler } from './commands/move-view-field.js';
import { UpdateViewFieldCommandHandler } from './commands/update-view-field.js';
import { UpdateViewSortCommandHandler } from './commands/update-view-sort.js';
import { GetEntityRecordsQueryHandler } from './queries/get-entity-records.js';
import { GetEntityRecordQueryHandler } from './queries/get-entity-record.js';
import { EntitiesController } from './entities.controller.js';

@Module({
  controllers: [EntitiesController],
  providers: [
    // plop:providers
    GetEntitiesQueryHandler,
    CreateEntityRecordCommandHandler,
    UpdateRecordValuesCommandHandler,
    MoveViewFieldCommandHandler,
    UpdateViewFieldCommandHandler,
    UpdateViewSortCommandHandler,
    GetEntityRecordsQueryHandler,
    GetEntityRecordQueryHandler,
  ],
})
export class EntitiesModule {}
