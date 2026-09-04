import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AGENT_ID } from '../constants';
import {
  RESOURCE_PLACEHOLDER,
  THREADS_QUERY_KEY,
  type ThreadSummary,
} from './use-threads';

/** mirror of RecruiterProfile in libs/feature/assistant; all fields optional */
export type RecruiterProfile = {
  territory?: string[];
  targetAumBands?: string[];
  credentials?: string[];
  firmTypes?: string[];
  firmsRecruitedFor?: { name: string; crd?: string }[];
  outputPreferences?: { rowLimit?: number; preferTables?: boolean };
  notes?: string;
};

export const RECRUITER_PROFILE_QUERY_KEY = ['assistant', 'profile'] as const;

/**
 * Working memory is resource-scoped, so reading it needs no real thread: the
 * server resolves the resource from the session. Writing goes through a
 * thread, so the write path finds or creates one (see ensureThread).
 */
const READ_THREAD_ID = '00000000-0000-4000-8000-000000000000';

/** the thread that holds preferences when the recruiter has no conversation yet */
export const PREFERENCES_THREAD_TITLE = 'Preferences';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const strings = (value: unknown): string[] | undefined =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : undefined;

export const parseRecruiterProfile = (raw: unknown): RecruiterProfile => {
  let value = raw;

  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }

  if (!isRecord(value)) return {};

  const prefs = isRecord(value.outputPreferences)
    ? value.outputPreferences
    : {};

  return {
    territory: strings(value.territory),
    targetAumBands: strings(value.targetAumBands),
    credentials: strings(value.credentials),
    firmTypes: strings(value.firmTypes),
    firmsRecruitedFor: Array.isArray(value.firmsRecruitedFor)
      ? value.firmsRecruitedFor.flatMap((firm) =>
          isRecord(firm) && typeof firm.name === 'string'
            ? [
                {
                  name: firm.name,
                  crd: typeof firm.crd === 'string' ? firm.crd : undefined,
                },
              ]
            : [],
        )
      : undefined,
    outputPreferences: {
      rowLimit: typeof prefs.rowLimit === 'number' ? prefs.rowLimit : undefined,
      preferTables:
        typeof prefs.preferTables === 'boolean'
          ? prefs.preferTables
          : undefined,
    },
    notes: typeof value.notes === 'string' ? value.notes : undefined,
  };
};

export const useRecruiterProfile = () => {
  const client = useMastraClient();

  return useQuery({
    queryKey: RECRUITER_PROFILE_QUERY_KEY,
    queryFn: async (): Promise<RecruiterProfile> => {
      const response = await client.getWorkingMemory({
        agentId: AGENT_ID,
        threadId: READ_THREAD_ID,
        resourceId: RESOURCE_PLACEHOLDER,
      });

      return parseRecruiterProfile(
        isRecord(response) ? response.workingMemory : null,
      );
    },
    staleTime: 30_000,
  });
};

/** the assistant reads memory at the start of a turn, so a save is live immediately */
export const useUpdateRecruiterProfile = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  const ensureThread = async (): Promise<string> => {
    const threads =
      queryClient.getQueryData<ThreadSummary[]>(THREADS_QUERY_KEY) ?? [];
    const existing = threads[0];

    if (existing) return existing.id;

    const threadId = crypto.randomUUID();

    await client.createMemoryThread({
      threadId,
      title: PREFERENCES_THREAD_TITLE,
      resourceId: RESOURCE_PLACEHOLDER,
      agentId: AGENT_ID,
      metadata: { system: true },
    });

    return threadId;
  };

  return useMutation({
    mutationFn: async (profile: RecruiterProfile) => {
      const threadId = await ensureThread();

      await client.updateWorkingMemory({
        agentId: AGENT_ID,
        threadId,
        resourceId: RESOURCE_PLACEHOLDER,
        workingMemory: JSON.stringify(profile),
      });

      return profile;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(RECRUITER_PROFILE_QUERY_KEY, profile);
    },
  });
};
