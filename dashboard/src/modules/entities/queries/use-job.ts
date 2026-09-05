import { useQuery } from '@tanstack/react-query';

import { jobsControllerGetJob } from '../../../api/generated/jobs/jobs';
import type { GetJobResponse } from '../../../api/generated/rIAScoutAPI.schemas';
import { QUERY_KEYS } from '../../../lib/query';

export type Job = GetJobResponse;

export const jobQueryKey = (jobId: string) => [QUERY_KEYS.jobs, jobId] as const;

export const isJobSettled = (job: Job | undefined): boolean =>
  job?.status === 'completed' || job?.status === 'failed';

/**
 * Polls a background job until it settles. There is no realtime channel in
 * this stack, so a two-second poll is the progress indicator; it stops the
 * moment the row reports completed or failed.
 */
export const useJob = (jobId: string | null | undefined) =>
  useQuery({
    queryKey: jobQueryKey(jobId ?? 'none'),
    queryFn: () => jobsControllerGetJob({ jobId: jobId ?? '' }),
    enabled: Boolean(jobId),
    refetchInterval: (query) => (isJobSettled(query.state.data) ? false : 2000),
  });
