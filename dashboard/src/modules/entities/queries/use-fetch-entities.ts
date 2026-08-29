import { useQuery } from '@tanstack/react-query';

import { entitiesControllerGetEntities } from '../../../api/generated/entities/entities';

export const entitiesQueryKey = ['entities'] as const;

/** the sidebar's source of truth for what a workspace contains */
export const useFetchEntities = () =>
  useQuery({
    queryKey: entitiesQueryKey,
    queryFn: () => entitiesControllerGetEntities(),
    staleTime: 5 * 60_000,
  });
