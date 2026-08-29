import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
  type Type,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@orm/app';

/** only production terminates TLS; dev and test run against a local postgres */
const ssl =
  process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : undefined;

const adapterFor = (connectionString: string): PrismaPg =>
  new PrismaPg({ connectionString, ssl });

@Injectable()
export class AppPrismaProvider
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /** guards connect/disconnect when api and worker share a process in watch mode */
  private static initialized = false;

  constructor() {
    const connectionString = process.env.APP_DATABASE_URL;

    if (!connectionString) {
      throw new Error('APP_DATABASE_URL is required');
    }

    super({ adapter: adapterFor(connectionString), errorFormat: 'minimal' });
  }

  async onModuleInit(): Promise<void> {
    if (AppPrismaProvider.initialized) {
      return;
    }

    AppPrismaProvider.initialized = true;
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (!AppPrismaProvider.initialized) {
      return;
    }

    AppPrismaProvider.initialized = false;
    await this.$disconnect();
  }

  /**
   * The single extension seam. Add extensions here so the injected type updates
   * in one place. Read replicas land here when a replica actually exists —
   * @prisma/extension-read-replicas throws on an empty replica list.
   */
  withExtensions() {
    return this.$extends({});
  }
}

/**
 * Opaque class so the injected type is the $extends result rather than Prisma's
 * recursive mapped types. Without this, DeepMockProxy cannot mock the service.
 */
const ExtendedPrismaClient = class {
  constructor(provider: AppPrismaProvider) {
    return provider.withExtensions();
  }
} as Type<ReturnType<AppPrismaProvider['withExtensions']>>;

@Injectable()
export class AppPrismaService extends ExtendedPrismaClient {
  constructor(provider: AppPrismaProvider) {
    super(provider);
  }
}
