import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AlsService } from '@system/als/als.service.js';
import { AppPrismaService } from '@system/database/database.service.js';

import type { CompleteOnboardingResponseDto } from '../dto/onboarding.dto.js';
import { requireIdentity } from '../identity.js';

export class CompleteOnboardingCommand extends Command<CompleteOnboardingResponseDto> {}

@CommandHandler(CompleteOnboardingCommand)
export class CompleteOnboardingCommandHandler implements ICommandHandler<CompleteOnboardingCommand> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute(): Promise<CompleteOnboardingResponseDto> {
    const { userId } = requireIdentity(this.alsService);

    /**
     * Idempotent: re-running the wizard must not move the timestamp, which is
     * the only record of when the account actually started.
     */
    const user = await this.appPrismaService.user.findUniqueOrThrow({
      where: { id: userId },
      select: { onboardedAt: true },
    });

    if (user.onboardedAt) {
      return { onboardedAt: user.onboardedAt };
    }

    const updated = await this.appPrismaService.user.update({
      where: { id: userId },
      data: { onboardedAt: new Date() },
      select: { onboardedAt: true },
    });

    return { onboardedAt: updated.onboardedAt ?? new Date() };
  }
}
