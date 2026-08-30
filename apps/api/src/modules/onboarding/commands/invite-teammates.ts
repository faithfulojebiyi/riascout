import { randomUUID } from 'node:crypto';

import { Logger } from '@nestjs/common';
import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AlsService } from '@system/als/als.service.js';
import { AppPrismaService } from '@system/database/database.service.js';

import type {
  InviteTeammatesDto,
  InviteTeammatesResponseDto,
} from '../dto/onboarding.dto.js';
import { requireIdentity } from '../identity.js';

const INVITE_TTL_DAYS = 7;

export class InviteTeammatesCommand extends Command<InviteTeammatesResponseDto> {
  constructor(public readonly dto: InviteTeammatesDto) {
    super();
  }
}

@CommandHandler(InviteTeammatesCommand)
export class InviteTeammatesCommandHandler implements ICommandHandler<InviteTeammatesCommand> {
  /** the link is logged rather than sent; see the emailOTP note in auth.ts */
  private readonly logger = new Logger('WorkspaceInvites');

  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
  ) {}

  async execute({
    dto,
  }: InviteTeammatesCommand): Promise<InviteTeammatesResponseDto> {
    const { workspaceId, userId } = requireIdentity(this.alsService);

    const emails = [
      ...new Set(dto.invites.map((invite) => invite.email.toLowerCase())),
    ];

    if (emails.length === 0) {
      return { invited: 0, skipped: [] };
    }

    const [members, pending] = await Promise.all([
      this.appPrismaService.member.findMany({
        where: { organizationId: workspaceId, user: { email: { in: emails } } },
        select: { user: { select: { email: true } } },
      }),
      this.appPrismaService.invitation.findMany({
        where: {
          organizationId: workspaceId,
          status: 'pending',
          email: { in: emails },
        },
        select: { email: true },
      }),
    ]);

    const taken = new Set([
      ...members.map((member) => member.user.email.toLowerCase()),
      ...pending.map((invitation) => invitation.email.toLowerCase()),
    ]);

    const expiresAt = new Date(
      Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const fresh = dto.invites.filter(
      (invite) => !taken.has(invite.email.toLowerCase()),
    );

    for (const invite of fresh) {
      const invitation = await this.appPrismaService.invitation.create({
        data: {
          id: randomUUID(),
          organizationId: workspaceId,
          inviterId: userId,
          email: invite.email.toLowerCase(),
          role: invite.role,
          status: 'pending',
          expiresAt,
        },
        select: { id: true, email: true },
      });

      this.logger.log(`invite for ${invitation.email}: ${invitation.id}`);
    }

    return { invited: fresh.length, skipped: [...taken] };
  }
}
