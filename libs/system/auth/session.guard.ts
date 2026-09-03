import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AlsService } from '@system/als/als.service.js';

import type { AuthSession } from './auth.js';
import { IS_PUBLIC_KEY } from './auth.decorators.js';
import { resolveSessionIdentity } from './session-identity.js';

type SessionRequest = {
  headers: Record<string, string | string[] | undefined>;
  session?: NonNullable<AuthSession>;
};

/**
 * Registered as APP_GUARD, so every route requires a session unless marked
 * @Public(). Fail-closed: a new endpoint is protected by default rather than
 * by remembering to add a decorator.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly als: AlsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<SessionRequest>();
    const identity = await resolveSessionIdentity(request.headers);

    if (!identity) {
      throw new UnauthorizedException();
    }

    request.session = identity.session;

    // identity flows through ALS so handlers never take it from the client
    this.als.ctx.set('userId', identity.userId);
    this.als.ctx.set('workspaceId', identity.workspaceId);

    return true;
  }
}
