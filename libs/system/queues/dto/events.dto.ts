import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Identity rides in the payload rather than in ALS. The worker is not
 * request-scoped and cannot import @system/als, so an event that does not carry
 * its workspace cannot be scoped by a consumer.
 */
export const eventUserSchema = z
  .object({
    userId: z.string(),
    workspaceId: z.string(),
  })
  .meta({ id: 'EventUser' });

export class EventUserDto extends createZodDto(eventUserSchema) {}

/** every event schema extends this, so a consumer always knows who triggered it */
export const withUser = <T extends z.ZodRawShape>(shape: T) =>
  z.object({ ...shape, user: eventUserSchema });
