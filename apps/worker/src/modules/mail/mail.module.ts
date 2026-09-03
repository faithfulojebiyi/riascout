import { Module } from '@nestjs/common';

import { MailModule as MailProviderModule } from '@providers/mail/mail.module.js';

// plop:imports
import { SendMailCommandHandler } from './commands/send-mail.js';

@Module({
  imports: [MailProviderModule],
  providers: [
    // plop:providers
    SendMailCommandHandler,
  ],
})
export class MailModule {}
