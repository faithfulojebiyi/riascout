import type { MastraDBMessage } from '@mastra/react';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

import { AGENT_ID } from '../constants';

export const threadMessagesKey = (threadId: string) =>
  ['assistant', 'thread', threadId, 'messages'] as const;

/**
 * History for a thread the user opened from the list. A brand-new thread has
 * no messages yet and the request is skipped so the first send is not gated
 * on a round trip.
 */
export const useThreadMessages = (threadId: string, enabled: boolean) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: threadMessagesKey(threadId),
    enabled,
    queryFn: async (): Promise<MastraDBMessage[]> => {
      const thread = client.getMemoryThread({ threadId, agentId: AGENT_ID });
      const result = await thread.listMessages({
        perPage: 100,
        orderBy: { field: 'createdAt', direction: 'ASC' },
      });

      return result.messages as MastraDBMessage[];
    },
    // a thread changes every time it is chatted in; always reload on open
    staleTime: 0,
    refetchOnMount: 'always',
  });
};
