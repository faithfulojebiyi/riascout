import { NotFoundException } from '@nestjs/common';
import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AlsService } from '@system/als/als.service.js';
import { AppPrismaService } from '@system/database/database.service.js';

import type { SavePreferencesDto } from '../dto/onboarding.dto.js';
import { readWorkspaceMetadata, requireIdentity } from '../identity.js';

export class SavePreferencesCommand extends Command<void> {
  constructor(public readonly dto: SavePreferencesDto) {
    super();
  }
}

@CommandHandler(SavePreferencesCommand)
export class SavePreferencesCommandHandler implements ICommandHandler<SavePreferencesCommand> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute({ dto }: SavePreferencesCommand): Promise<void> {
    const { workspaceId } = requireIdentity(this.alsService);

    const workspace = await this.appPrismaService.organization.findUnique({
      where: { id: workspaceId },
      select: { metadata: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace no longer exists');
    }

    // merged rather than replaced: metadata is shared with better-auth's plugin
    const metadata = {
      ...readWorkspaceMetadata(workspace.metadata),
      useCases: dto.useCases,
    };

    await this.appPrismaService.organization.update({
      where: { id: workspaceId },
      data: { metadata: JSON.stringify(metadata) },
    });
  }
}
