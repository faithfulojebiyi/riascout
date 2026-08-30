import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { prospectingControllerSearchAdvisors } from '../../../api/generated/prospecting/prospecting';
import type { SearchAdvisors } from '../types/prospecting';

/**
 * keepPreviousData so the result count does not flash to zero between filter
 * edits — a recruiter reads a blank grid as "no matches", not as "loading".
 */
export const useSearchProspects = (body: SearchAdvisors, enabled = true) =>
  useQuery({
    queryKey: ['prospect-search', body] as const,
    queryFn: () => prospectingControllerSearchAdvisors(body),
    placeholderData: keepPreviousData,
    enabled,
  });
