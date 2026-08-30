import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AlsService } from '@system/als/als.service.js';
import { AppPrismaService } from '@system/database/database.service.js';

import type { SaveWorkspaceDto } from '../dto/onboarding.dto.js';
import { requireIdentity } from '../identity.js';

export class SaveWorkspaceCommand extends Command<void> {
  constructor(public readonly dto: SaveWorkspaceDto) {
    super();
  }
}

@CommandHandler(SaveWorkspaceCommand)
export class SaveWorkspaceCommandHandler implements ICommandHandler<SaveWorkspaceCommand> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  /**
   * Renames the workspace sign-up already created — it holds the entities and
   * attributes provisioned with it, so creating a second one here would strand
   * them and leave the account pointing at an empty CRM.
   */
  async execute({ dto }: SaveWorkspaceCommand): Promise<void> {
    const { workspaceId } = requireIdentity(this.alsService);

    await this.appPrismaService.organization.update({
      where: { id: workspaceId },
      data: { name: dto.name, logo: dto.logo },
    });
  }
}
