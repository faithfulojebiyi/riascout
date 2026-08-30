import { Module } from '@nestjs/common';

// plop:imports
import { AddToListCommandHandler } from './commands/add-to-list.js';
import { CreateListCommandHandler } from './commands/create-list.js';
import { GetListsQueryHandler } from './queries/get-lists.js';
import { ListsController } from './lists.controller.js';

@Module({
  controllers: [ListsController],
  providers: [
    // plop:providers
    AddToListCommandHandler,
    CreateListCommandHandler,
    GetListsQueryHandler,
  ],
})
export class ListsModule {}
