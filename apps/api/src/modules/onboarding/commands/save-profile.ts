import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AlsService } from '@system/als/als.service.js';
import { AppPrismaService } from '@system/database/database.service.js';

import type { SaveProfileDto } from '../dto/onboarding.dto.js';
import { requireIdentity } from '../identity.js';

export class SaveProfileCommand extends Command<void> {
  constructor(public readonly dto: SaveProfileDto) {
    super();
  }
}

@CommandHandler(SaveProfileCommand)
export class SaveProfileCommandHandler implements ICommandHandler<SaveProfileCommand> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute({ dto }: SaveProfileCommand): Promise<void> {
    const { userId } = requireIdentity(this.alsService);

    /**
     * better-auth stores a single name, so the two fields are joined here
     * rather than adding columns that only this screen would read.
     */
    const name = [dto.firstName, dto.lastName]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' ');

    await this.appPrismaService.user.update({
      where: { id: userId },
      data: {
        name,
        image: dto.image,
        marketingOptIn: dto.marketingOptIn,
      },
    });
  }
}
