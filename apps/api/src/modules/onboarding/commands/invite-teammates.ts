import { randomUUID } from 'node:crypto';

import { Logger } from '@nestjs/common';
import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AlsService } from '@system/als/als.service.js';
import { AppPrismaService } from '@system/database/database.service.js';
import { EVENT_KEYS } from '@system/queues/events.config.js';

import { EventPublisherService } from '../../event-publisher/event-publisher.service.js';

import type {
  InviteTeammatesDto,
  InviteTeammatesResponseDto,
} from '../dto/onboarding.dto.js';
import { requireIdentity } from '../identity.js';

const INVITE_TTL_DAYS = 7;

/** the dashboard origin, which is not BETTER_AUTH_URL — that one is the api */
const appUrl = (): string =>
  (process.env.APP_URL ?? 'http://localhost:3020').replace(/\/+$/, '');

export class InviteTeammatesCommand extends Command<InviteTeammatesResponseDto> {
  constructor(public readonly dto: InviteTeammatesDto) {
    super();
  }
}

@CommandHandler(InviteTeammatesCommand)
export class InviteTeammatesCommandHandler implements ICommandHandler<InviteTeammatesCommand> {
  private readonly logger = new Logger('WorkspaceInvites');

  constructor(
    private readonly appPrismaService: AppPrismaService,
    private readonly alsService: AlsService,
    private readonly eventPublisherService: EventPublisherService,
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

    const [workspace, inviter] = await Promise.all([
      this.appPrismaService.organization.findUnique({
        where: { id: workspaceId },
        select: { name: true },
      }),
      this.appPrismaService.user.findUnique({
        where: { id: userId },
        select: { name: true },
      }),
    ]);

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

      /**
       * Published after the row exists, so a crash between the two replays the
       * send rather than mailing a link to an invitation that was never
       * written. The idempotency key absorbs the replay.
       */
      await this.eventPublisherService.sendEvent({
        name: EVENT_KEYS.MAIL_SEND,
        data: {
          template: 'workspace-invite',
          to: invitation.email,
          props: {
            workspaceName: workspace?.name ?? 'your workspace',
            invitedBy: inviter?.name ?? null,
            acceptUrl: `${appUrl()}/sign-in?invitation=${invitation.id}`,
          },
          idempotencyKey: `workspace-invite/${invitation.id}`,
        },
        user: { userId, workspaceId },
      });
    }

    return { invited: fresh.length, skipped: [...taken] };
  }
}
