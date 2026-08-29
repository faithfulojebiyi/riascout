import {
  createParamDecorator,
  ForbiddenException,
  SetMetadata,
  type ExecutionContext,
} from '@nestjs/common';

import type { AuthSession } from './auth.js';

export const IS_PUBLIC_KEY = 'auth:isPublic';

/** opts a route out of SessionGuard, which is otherwise fail-closed */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);

type SessionRequest = { session?: NonNullable<AuthSession> };

export const CurrentUser = createParamDecorator(
  (field: string | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<SessionRequest>();
    const user = request.session?.user;

    return field && user ? user[field as keyof typeof user] : user;
  },
);

/**
 * The active workspace, from the session — never from a request header. A
 * client-supplied workspace makes tenant isolation an assertion the client
 * controls, which is how the legacy app leaked across tenants.
 */
export const Workspace = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<SessionRequest>();
    const workspaceId = request.session?.session.activeOrganizationId;

    if (!workspaceId) {
      throw new ForbiddenException('No active workspace for this session');
    }

    return workspaceId;
  },
);
