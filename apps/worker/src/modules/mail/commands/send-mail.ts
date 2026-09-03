import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import {
  MailService,
  type SendMailInput,
} from '@providers/mail/mail.service.js';
import type { MailTemplateName } from '@providers/mail/templates.js';
import type { SendMailDto } from '@system/queues/dto/mail.dto.js';

export class SendMailCommand extends Command<void> {
  constructor(public readonly payload: SendMailDto) {
    super();
  }
}

/**
 * The event carries props as unknown — system cannot depend on the provider's
 * template types — so the narrowing happens here, at the one place that knows
 * both sides.
 */
@CommandHandler(SendMailCommand)
export class SendMailCommandHandler implements ICommandHandler<SendMailCommand> {
  constructor(private readonly mailService: MailService) {}

  async execute({ payload }: SendMailCommand): Promise<void> {
    await this.mailService.send({
      to: payload.to,
      template: payload.template,
      props: payload.props,
      idempotencyKey: payload.idempotencyKey,
    } as SendMailInput<MailTemplateName>);
  }
}
