import { useMutation, useQueryClient } from '@tanstack/react-query';

import { entitiesControllerCreateEntityRecord } from '../../../api/generated/entities/entities';
import type { CreateEntityRecord } from '../../../api/generated/rIAScoutAPI.schemas';
import { QUERY_KEYS } from '../../../lib/query';
import { toast } from '../../../ui/primitives/toast/toast';

/**
 * Save-to-CRM. The endpoint is idempotent on (entity, sourceKind, sourceCrd) and
 * returns created:false when the advisor was already saved, so re-adding is not
 * an error and must not read as one.
 */
export const useCreateEntityRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateEntityRecord) =>
      entitiesControllerCreateEntityRecord(body),
    onSuccess: (result) => {
      toast.success(
        result.created ? 'Saved to your CRM' : 'Already in your CRM',
      );
      void queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.entityRecords],
      });
    },
    onError: () => toast.error('Could not save that record'),
  });
};
