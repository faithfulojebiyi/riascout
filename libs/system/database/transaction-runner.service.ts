import { Injectable } from '@nestjs/common';

import { AppPrismaService } from './database.service.js';

export type AppPrismaTx = Parameters<Parameters<AppPrismaService['$transaction']>[0]>[0];

type Deferred = () => void | Promise<void>;

@Injectable()
export class TransactionRunner {
  constructor(private readonly appPrismaService: AppPrismaService) {}

  /**
   * Runs work in one transaction and defers side effects until after commit,
   * so a rollback drops them entirely. Use for any write that emits an event.
   */
  async run<T>(work: (tx: AppPrismaTx, defer: (fn: Deferred) => void) => Promise<T>): Promise<T> {
    const deferred: Deferred[] = [];

    const result = await this.appPrismaService.$transaction((tx) =>
      work(tx as AppPrismaTx, (fn) => deferred.push(fn)),
    );

    for (const fn of deferred) {
      await fn();
    }

    return result as T;
  }
}
