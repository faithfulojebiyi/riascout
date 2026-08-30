import { Module } from '@nestjs/common';

// plop:imports
import { GetFirmMovesQueryHandler } from './queries/get-firm-moves.js';
import { GetFirmFlowsQueryHandler } from './queries/get-firm-flows.js';
import { MovementController } from './movement.controller.js';

@Module({
  controllers: [MovementController],
  providers: [
    // plop:providers
    GetFirmMovesQueryHandler,
    GetFirmFlowsQueryHandler,
  ],
})
export class MovementModule {}
