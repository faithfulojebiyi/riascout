import { useMastraClient } from '@mastra/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { AGENT_ID } from '../constants';

export type ThreadSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export const THREADS_QUERY_KEY = ['assistant', 'threads'] as const;

/**
 * The server pins the resource id from the session, so the value sent here is
 * only satisfying the client's required parameter; it never selects data.
 */
export const RESOURCE_PLACEHOLDER = 'session';

const asIso = (value: unknown): string =>
  value instanceof Date
    ? value.toISOString()
    : typeof value === 'string'
      ? value
      : new Date(0).toISOString();

export const useThreads = () => {
  const client = useMastraClient();

  return useQuery({
    queryKey: THREADS_QUERY_KEY,
    queryFn: async (): Promise<ThreadSummary[]> => {
      const result = await client.listMemoryThreads({
        agentId: AGENT_ID,
        resourceId: RESOURCE_PLACEHOLDER,
        orderBy: { field: 'updatedAt', direction: 'DESC' },
        page: 0,
        perPage: 50,
      });

      return result.threads.map((thread) => ({
        id: thread.id,
        title: thread.title ?? '',
        createdAt: asIso(thread.createdAt),
        updatedAt: asIso(thread.updatedAt),
      }));
    },
    staleTime: 15_000,
  });
};

export const useInvalidateThreads = () => {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: THREADS_QUERY_KEY });
};
