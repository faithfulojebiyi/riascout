import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AlsModule } from '@system/als/als.module.js';

import { SessionGuard } from './session.guard.js';

/**
 * Global so SessionGuard binds once as APP_GUARD. Auth is api-only — the worker
 * has no request and takes identity from the Inngest event payload instead.
 */
@Global()
@Module({
  imports: [AlsModule],
  providers: [{ provide: APP_GUARD, useClass: SessionGuard }],
})
export class AuthModule {}
