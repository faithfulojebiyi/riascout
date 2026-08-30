import { NotFoundException } from '@nestjs/common';
import { Query, QueryHandler, IQueryHandler } from '@nestjs/cqrs';

import { AlsService } from '@system/als/als.service.js';
import { AppPrismaService } from '@system/database/database.service.js';

import type { OnboardingStateDto } from '../dto/onboarding.dto.js';
import { readWorkspaceMetadata, requireIdentity } from '../identity.js';

export class GetOnboardingStateQuery extends Query<OnboardingStateDto> {}

@QueryHandler(GetOnboardingStateQuery)
export class GetOnboardingStateQueryHandler implements IQueryHandler<GetOnboardingStateQuery> {
  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute(): Promise<OnboardingStateDto> {
    const { workspaceId, userId } = requireIdentity(this.alsService);

    const [user, workspace, invitations] = await Promise.all([
      this.appPrismaService.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          email: true,
          image: true,
          marketingOptIn: true,
          onboardedAt: true,
        },
      }),
      this.appPrismaService.organization.findUnique({
        where: { id: workspaceId },
        select: { id: true, name: true, logo: true, metadata: true },
      }),
      this.appPrismaService.invitation.findMany({
        where: { organizationId: workspaceId, status: 'pending' },
        select: { email: true },
      }),
    ]);

    if (!user || !workspace) {
      throw new NotFoundException('Account or workspace no longer exists');
    }

    return {
      user: {
        name: user.name,
        email: user.email,
        image: user.image,
        marketingOptIn: user.marketingOptIn,
        onboardedAt: user.onboardedAt,
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
        logo: workspace.logo,
      },
      preferences: readWorkspaceMetadata(workspace.metadata),
      pendingInvites: invitations.map((invitation) => invitation.email),
    };
  }
}
