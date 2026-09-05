import { z } from 'zod';

import { defineTool } from './define-tool.js';

export const getJobTool = defineTool({
  id: 'get_job',
  scope: 'read',
  approval: false,
  description: [
    'Progress of a queued save, by the jobId add_to_list returned.',
    'Call it when the recruiter asks whether a save finished or how many were added. requested is 0 while a filter save is still resolving its population.',
  ].join(' '),
  input: z.object({ jobId: z.string().uuid() }),
  output: z.object({
    id: z.string(),
    status: z.enum(['queued', 'running', 'completed', 'failed']),
    requested: z.number().int(),
    processed: z.number().int(),
    /** records newly brought into the CRM by this job */
    created: z.number().int(),
    /** memberships added; lower than requested when some were already members */
    added: z.number().int(),
    error: z.string().nullable(),
    listId: z.string().nullable(),
  }),
  execute: async ({ jobId }, { queries, identity }) => {
    const job = await queries.getJob(identity, jobId);

    return {
      id: job.id,
      status: job.status,
      requested: job.requested,
      processed: job.processed,
      created: job.created,
      added: job.added,
      error: job.error,
      listId:
        typeof job.payload.listId === 'string' ? job.payload.listId : null,
    };
  },
});
