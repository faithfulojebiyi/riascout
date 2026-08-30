import { useQuery } from '@tanstack/react-query';

import { prospectingControllerGetFacets } from '../../../api/generated/prospecting/prospecting';

/**
 * Definitions are global reference data keyed only by source kind, so they are
 * fetched once and kept. The options query behind them costs seconds cold.
 */
export const useFetchFacets = (sourceKind: 'advisor' | 'firm' = 'advisor') =>
  useQuery({
    queryKey: ['prospecting-facets', sourceKind] as const,
    queryFn: () => prospectingControllerGetFacets({ sourceKind }),
    staleTime: Infinity,
  });
