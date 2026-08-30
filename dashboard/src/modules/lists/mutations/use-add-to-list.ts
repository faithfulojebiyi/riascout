import { useMutation, useQueryClient } from '@tanstack/react-query';

import { listsControllerAddToList } from '../../../api/generated/lists/lists';
import type { AddToList } from '../../../api/generated/rIAScoutAPI.schemas';
import { toast } from '../../../ui/primitives/toast/toast';

/**
 * Re-adding is idempotent, so a zero result is "already there", not a failure.
 * Saying "added 0" would read as an error the user needs to act on.
 */
export const useAddToList = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AddToList) => listsControllerAddToList(body),
    onSuccess: (result) => {
      const already = result.requested - result.membersAdded;

      toast.success(
        result.membersAdded === 0
          ? `All ${result.requested} already in this list`
          : `Added ${result.membersAdded}${already > 0 ? `, ${already} already there` : ''}`,
      );

      void queryClient.invalidateQueries({ queryKey: ['lists'] });
      void queryClient.invalidateQueries({ queryKey: ['prospect-search'] });
    },
    onError: () => toast.error('Could not add to that list'),
  });
};
