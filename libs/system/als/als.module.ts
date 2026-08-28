import { Global, Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { randomUUID } from 'node:crypto';

import { AlsService } from './als.service.js';

@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: () => randomUUID(),
        setup: (cls, req: { headers?: Record<string, string | undefined> }) => {
          cls.set('requestId', req.headers?.['x-request-id'] ?? cls.getId());
        },
      },
    }),
  ],
  providers: [AlsService],
  exports: [AlsService],
})
export class AlsModule {}
