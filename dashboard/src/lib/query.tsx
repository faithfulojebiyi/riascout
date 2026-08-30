import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

import { toast } from '../ui/primitives/toast/toast';

export const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // the grid and rail refetch on their own terms; a window focus should
        // not re-run a count over 510k rows
        refetchOnWindowFocus: false,
        retry: 1,
        // above zero so SSR does not refetch everything immediately on hydrate
        staleTime: 30_000,
      },
    },
    /**
     * One place for read failures, so a screen does not have to remember to
     * report them. A query opts out with meta.suppressErrorToast when it
     * renders its own empty or error state.
     */
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.meta?.suppressErrorToast) return;

        toast.error(error instanceof Error ? error.message : 'Request failed');
      },
    }),
  });

let browserQueryClient: QueryClient | undefined;

/**
 * A fresh client per server render — a module singleton would leak one user's
 * cache into another's response. In the browser it is created once: React may
 * suspend during the initial render, and rebuilding the client there would
 * throw the cache away.
 */
export const getQueryClient = (): QueryClient => {
  if (typeof window === 'undefined') return makeQueryClient();

  browserQueryClient ??= makeQueryClient();

  return browserQueryClient;
};

export const QueryProvider = ({ children }: PropsWithChildren) => (
  // not useState: with no suspense boundary between here and a suspending
  // child, React would discard the client on the initial render
  <QueryClientProvider client={getQueryClient()}>
    {children}
  </QueryClientProvider>
);

/**
 * Every query key in one place. Invalidation matches by prefix, so a mutation
 * that invalidates a literal string it typed itself fails silently — the
 * refetch simply never happens and the screen shows stale data.
 */
export const QUERY_KEYS = {
  entities: 'entities',
  entityRecords: 'entity-records',
  facetOptions: 'facet-options',
  lists: 'lists',
  onboarding: 'onboarding',
  prospectSearch: 'prospect-search',
  prospectingFacets: 'prospecting-facets',
} as const;
