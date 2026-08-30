import { useQuery } from '@tanstack/react-query';

import { entitiesControllerGetEntityRecords } from '../../../api/generated/entities/entities';
import type { GetEntityRecords } from '../../../api/generated/rIAScoutAPI.schemas';
import { QUERY_KEYS } from '../../../lib/query';

export const entityRecordsQueryKey = (body: GetEntityRecords) =>
  [QUERY_KEYS.entityRecords, body] as const;

/**
 * The first page, used to seed the view definition before ag-grid mounts.
 * Subsequent pages come from the SSRM datasource, not from react-query — ag-grid
 * owns its own block cache and two caches over the same rows drift.
 */
export const useFetchEntityRecords = (body: GetEntityRecords) =>
  useQuery({
    queryKey: entityRecordsQueryKey(body),
    queryFn: () => entitiesControllerGetEntityRecords(body),
  });
