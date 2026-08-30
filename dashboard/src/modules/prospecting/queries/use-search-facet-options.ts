import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { prospectingControllerSearchFacetOptions } from '../../../api/generated/prospecting/prospecting';
import { QUERY_KEYS } from '../../../lib/query';

/**
 * Options are global reference data that only change on an etl run, so they
 * cache indefinitely. keepPreviousData stops the list emptying between
 * keystrokes, which reads as "no matches" rather than "still typing".
 */
export const useSearchFacetOptions = (
  allowKey: string,
  query: string,
  enabled: boolean,
) =>
  useQuery({
    queryKey: [QUERY_KEYS.facetOptions, allowKey, query] as const,
    queryFn: () =>
      prospectingControllerSearchFacetOptions({ allowKey, query, limit: 20 }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  });
