import { useQuery } from '@tanstack/react-query';

import { listsControllerGetLists } from '../../../api/generated/lists/lists';
import { QUERY_KEYS } from '../../../lib/query';

export const listsQueryKey = (entityId: string | null) =>
  [QUERY_KEYS.lists, entityId] as const;

export const useFetchLists = (entityId: string | null = null) =>
  useQuery({
    queryKey: listsQueryKey(entityId),
    queryFn: () => listsControllerGetLists({ entityId }),
  });
