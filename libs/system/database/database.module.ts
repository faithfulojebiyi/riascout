import { Global, Module } from '@nestjs/common';

import { AppPrismaProvider, AppPrismaService } from './database.service.js';
import { TransactionRunner } from './transaction-runner.service.js';

@Global()
@Module({
  providers: [AppPrismaProvider, AppPrismaService, TransactionRunner],
  exports: [AppPrismaService, TransactionRunner],
})
export class DatabaseModule {}
