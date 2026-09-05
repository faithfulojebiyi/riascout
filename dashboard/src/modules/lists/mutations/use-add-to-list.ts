import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';

import { jobsControllerGetJob } from '../../../api/generated/jobs/jobs';
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
    return result.requested > 0
      ? `Adding ${result.requested.toLocaleString()} in the background`
      : 'Adding the matching records in the background';
  }

  if (result.membersAdded === 0) {
    return `All ${result.requested.toLocaleString()} already in this list`;
  }

  const already = result.requested - result.membersAdded;

  return already > 0
    ? `Added ${result.membersAdded.toLocaleString()}, ${already.toLocaleString()} already there`
    : `Added ${result.membersAdded.toLocaleString()}`;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Polls the job the queued add returned and reports the outcome once, so a
 * save that finishes or fails after the response is never silent.
 */
const watchJob = async (jobId: string, onSettled: () => void) => {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    await sleep(2000);

    const job = await jobsControllerGetJob({ jobId }).catch(() => null);

    if (!job) return;

    if (job.status === 'completed') {
      toast.success(
        job.added === 0
          ? `All ${job.requested.toLocaleString()} were already in the list`
          : `Added ${job.added.toLocaleString()} to the list`,
      );
      onSettled();

      return;
    }

    if (job.status === 'failed') {
      toast.error('The background add failed; nothing more was added');
      onSettled();

      return;
    }
  }
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

      if (!result.completed && result.jobId) {
        void watchJob(result.jobId, invalidate);
      }
    },
    onError: () => toast.error('Could not add to that list'),
  });
};
