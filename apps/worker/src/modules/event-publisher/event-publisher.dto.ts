import type { CommandBus, QueryBus } from '@nestjs/cqrs';

/**
 * The DI-resolved buses handed to inngest consumers. Consumers stay thin — they
 * dispatch a command; the handler holds the logic, so the same work is
 * reachable without an event.
 */
export type InngestFunctionDto = {
  commandBus: CommandBus;
  queryBus: QueryBus;
};
