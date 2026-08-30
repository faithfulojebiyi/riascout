import { useQuery } from '@tanstack/react-query';

import { listsControllerGetLists } from '../../../api/generated/lists/lists';

export const listsQueryKey = (entityId: string | null) =>
  ['lists', entityId] as const;

export const useFetchLists = (entityId: string | null = null) =>
  useQuery({
    queryKey: listsQueryKey(entityId),
    queryFn: () => listsControllerGetLists({ entityId }),
  });
