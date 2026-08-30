import { createRouter } from '@tanstack/react-router';

import { AppProviders } from './modules/system/providers/app-providers';
import { routeTree } from './routeTree.gen';

/** TanStack Start looks for `getRouter` on the router entry, not `createRouter` */
export const getRouter = () =>
  createRouter({
    routeTree,
    /**
     * Wrap rather than nesting in __root: this covers pending and error
     * components too, which render outside the root's Outlet.
     */
    Wrap: ({ children }) => <AppProviders>{children}</AppProviders>,
    // preload on hover/focus so navigation feels instant in a dense grid app
    defaultPreload: 'intent',
    defaultStaleTime: 30_000,
    scrollRestoration: true,
  });

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
