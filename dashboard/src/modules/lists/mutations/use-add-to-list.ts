import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';

import { listsControllerAddToList } from '../../../api/generated/lists/lists';
import type {
  AddToList,
  AddToListResponse,
} from '../../../api/generated/rIAScoutAPI.schemas';
import { QUERY_KEYS } from '../../../lib/query';
import { toast } from '../../../ui/primitives/toast/toast';

/**
 * A queued add reports zero counts because they are not known yet, so
 * `completed` has to be read before the numbers. Treating zero as "already
 * there" would tell someone their save did nothing at the moment it started.
 */
const message = (result: AddToListResponse): string => {
  if (!result.completed) {
    return `Adding ${result.requested.toLocaleString()} in the background`;
  }

  if (result.membersAdded === 0) {
    return `All ${result.requested.toLocaleString()} already in this list`;
  }

  const already = result.requested - result.membersAdded;

  return already > 0
    ? `Added ${result.membersAdded.toLocaleString()}, ${already.toLocaleString()} already there`
    : `Added ${result.membersAdded.toLocaleString()}`;
};

export const useAddToList = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (body: AddToList) => listsControllerAddToList(body),
    onSuccess: (result) => {
      toast.success(message(result));

      /**
       * A queued add is still running, so the member count is stale the moment
       * it returns. Refetching later is what makes it settle without polling.
       */
      const invalidate = () => {
        void queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.lists] });
        void queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.prospectSearch],
        });
        /**
         * An add creates records, so the sidebar's per-entity count and the
         * entity page total both move. The total comes from the route loader
         * rather than a query, hence the router invalidate.
         */
        void queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.entities] });
        void router.invalidate();
      };

      invalidate();

      if (!result.completed) {
        setTimeout(invalidate, 4000);
      }
    },
    onError: () => toast.error('Could not add to that list'),
  });
};
