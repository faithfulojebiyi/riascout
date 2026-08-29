import { createRouter } from '@tanstack/react-router';

import { routeTree } from './routeTree.gen';

/** TanStack Start looks for `getRouter` on the router entry, not `createRouter` */
export const getRouter = () =>
  createRouter({
    routeTree,
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
