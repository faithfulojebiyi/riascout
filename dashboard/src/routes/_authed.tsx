import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';

import { authClient } from '../lib/auth-client';

/**
 * Pathless layout gate. Runs client-side: the session cookie lives in the
 * browser and the api is a separate origin, so the dashboard's server has no
 * cookie to check during SSR.
 */
export const Route = createFileRoute('/_authed')({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await authClient.getSession();

    if (!data) {
      throw redirect({ to: '/sign-in', search: { redirect: location.href } });
    }

    return { user: data.user, workspaceId: data.session.activeOrganizationId };
  },
  component: () => <Outlet />,
});
