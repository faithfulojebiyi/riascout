import { useQuery } from '@tanstack/react-query';

import { entitiesControllerGetEntities } from '../../../api/generated/entities/entities';
import { QUERY_KEYS } from '../../../lib/query';

export const entitiesQueryKey = [QUERY_KEYS.entities] as const;

/** the sidebar's source of truth for what a workspace contains */
export const useFetchEntities = () =>
  useQuery({
    queryKey: entitiesQueryKey,
    queryFn: () => entitiesControllerGetEntities(),
    staleTime: 5 * 60_000,
  });
