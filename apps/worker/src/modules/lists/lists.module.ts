import { Module } from '@nestjs/common';

// plop:imports
import { BulkAddToListCommandHandler } from './commands/bulk-add-to-list.js';

@Module({
  providers: [
    // plop:providers
    BulkAddToListCommandHandler,
  ],
})
export class ListsModule {}
