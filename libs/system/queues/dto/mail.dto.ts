import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { withUser } from './events.dto.js';

/**
 * The rendered body is not carried: the worker renders from the template name
 * and props, so a template fix reaches events already queued rather than only
 * new ones. props stays opaque because system is the lower layer and must not
 * depend on the provider's template types — the consumer narrows it.
 */
export const sendMailSchema = withUser({
  template: z.enum(['sign-in-otp', 'workspace-invite']),
  to: z.email(),
  props: z.unknown(),
  /** `<event-type>/<entity-id>`; absorbs an inngest retry of the same send */
  idempotencyKey: z.string().max(256).optional(),
}).meta({ id: 'SendMail' });

export class SendMailDto extends createZodDto(sendMailSchema) {}
