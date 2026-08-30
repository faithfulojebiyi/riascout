import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AlsService } from '@system/als/als.service.js';

import * as authModule from './auth.js';
import { auth } from './auth.js';
import { SessionGuard } from './session.guard.js';

/**
 * The guard is fail-closed by construction, so the cases that matter are the
 * ones where it must NOT let a request through.
 */
describe('SessionGuard', () => {
  const contextFor = (request: object, isPublic = false): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => (): void => undefined,
      getClass: () => class {},
      // the reflector reads metadata off these; stubbed via getAllAndOverride below
      _isPublic: isPublic,
    }) as unknown as ExecutionContext;

  const guardWith = (isPublic: boolean) => {
    const reflector = new Reflector();
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);

    const store = new Map<string, unknown>();
    const als = {
      ctx: { set: (k: string, v: unknown) => store.set(k, v) },
    } as unknown as AlsService;

    return { guard: new SessionGuard(reflector, als), store };
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lets a @Public() route through without touching auth', async () => {
    const spy = vi.spyOn(auth.api, 'getSession');
    const { guard } = guardWith(true);

    await expect(guard.canActivate(contextFor({ headers: {} }))).resolves.toBe(
      true,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects a request with no session', async () => {
    vi.spyOn(auth.api, 'getSession').mockResolvedValue(null as never);
    const { guard } = guardWith(false);

    await expect(
      guard.canActivate(contextFor({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches the session and pushes identity into ALS', async () => {
    vi.spyOn(auth.api, 'getSession').mockResolvedValue({
      user: { id: 'user-1' },
      session: { activeOrganizationId: 'org-1' },
    } as never);

    const request: { headers: Record<string, string>; session?: unknown } = {
      headers: {},
    };
    const { guard, store } = guardWith(false);

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.session).toBeDefined();
    expect(store.get('userId')).toBe('user-1');
    expect(store.get('workspaceId')).toBe('org-1');
  });

  /**
   * A session issued before its membership existed carries no active
   * organization. Without this the user is 403'd from every route until they
   * sign out and back in, with nothing telling them why.
   */
  it('resolves a workspace when the session carries none', async () => {
    vi.spyOn(auth.api, 'getSession').mockResolvedValue({
      user: { id: 'user-2' },
      session: { activeOrganizationId: null, token: 'tok-2' },
    } as never);
    const resolve = vi
      .spyOn(authModule, 'resolveActiveWorkspace')
      .mockResolvedValue('org-recovered');

    const { guard, store } = guardWith(false);

    await expect(guard.canActivate(contextFor({ headers: {} }))).resolves.toBe(
      true,
    );
    expect(resolve).toHaveBeenCalledWith('user-2', 'tok-2');
    expect(store.get('workspaceId')).toBe('org-recovered');
  });

  /** a user with genuinely no workspace still gets nothing, not someone else's */
  it('records no workspace when the user has none to resolve', async () => {
    vi.spyOn(auth.api, 'getSession').mockResolvedValue({
      user: { id: 'user-4' },
      session: { activeOrganizationId: null, token: 'tok-4' },
    } as never);
    vi.spyOn(authModule, 'resolveActiveWorkspace').mockResolvedValue(undefined);

    const { guard, store } = guardWith(false);

    await expect(guard.canActivate(contextFor({ headers: {} }))).resolves.toBe(
      true,
    );
    expect(store.get('workspaceId')).toBeUndefined();
  });

  it('does not resolve when the session already has a workspace', async () => {
    vi.spyOn(auth.api, 'getSession').mockResolvedValue({
      user: { id: 'user-5' },
      session: { activeOrganizationId: 'org-5', token: 'tok-5' },
    } as never);
    const resolve = vi.spyOn(authModule, 'resolveActiveWorkspace');

    const { guard } = guardWith(false);

    await guard.canActivate(contextFor({ headers: {} }));
    expect(resolve).not.toHaveBeenCalled();
  });

  it('never reads the workspace from a request header', async () => {
    vi.spyOn(auth.api, 'getSession').mockResolvedValue({
      user: { id: 'user-3' },
      session: { activeOrganizationId: 'real-org' },
    } as never);

    const { guard, store } = guardWith(false);
    const request = { headers: { 'x-workspace-id': 'attacker-supplied' } };

    await guard.canActivate(contextFor(request));

    expect(store.get('workspaceId')).toBe('real-org');
  });
});
