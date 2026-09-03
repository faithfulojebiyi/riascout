import { fromNodeHeaders } from 'better-auth/node';

import { auth, resolveActiveWorkspace, type AuthSession } from './auth.js';

export type SessionIdentity = {
  session: NonNullable<AuthSession>;
  userId: string;
  /** undefined when the user has no workspace at all, which stays a 403 */
  workspaceId: string | undefined;
};

type NodeHeaders = Record<string, string | string[] | undefined>;

/**
 * The one place a request's headers become a user and workspace. SessionGuard
 * uses it for Nest routes; the assistant mount uses it for Mastra's routes, so
 * both surfaces agree on who is calling.
 */
export const resolveSessionIdentity = async (
  headers: NodeHeaders,
): Promise<SessionIdentity | null> => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(headers),
  });

  if (!session) {
    return null;
  }

  /**
   * A session issued before its membership existed carries no active
   * organization, and nothing refreshes it — so resolve it here rather than
   * leaving the user permanently 403'd until they sign out and back in.
   */
  const workspaceId =
    session.session.activeOrganizationId ??
    (await resolveActiveWorkspace(session.user.id, session.session.token));

  return { session, userId: session.user.id, workspaceId };
};
