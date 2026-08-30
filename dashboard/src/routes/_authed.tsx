import { css } from '@riascout-ui/styled-system/css';
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';

import { authClient } from '../lib/auth-client';
import { AppSidebar } from '../modules/layout/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '../ui/primitives/sidebar';

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

    // a half-set-up account would land on a grid it has not named a workspace for
    if (!data.user.onboardedAt) {
      throw redirect({ to: '/onboarding' });
    }

    return { user: data.user, workspaceId: data.session.activeOrganizationId };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user } = Route.useRouteContext();

  return (
    <SidebarProvider>
      <div className={css({ display: 'flex', h: '100dvh', w: 'full' })}>
        <AppSidebar workspaceName={user.name ?? 'Workspace'} />
        <SidebarInset>
          <Outlet />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
