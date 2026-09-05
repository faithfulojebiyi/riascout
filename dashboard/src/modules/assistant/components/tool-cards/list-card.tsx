import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';

import { QUERY_KEYS } from '../../../../lib/query';
import { Icons } from '../../../../ui/icons/base';
import { isJobSettled, useJob } from '../../../entities/queries/use-job';
import { ArtifactCard } from './artifact-card';
import { type ApprovalDescription, isRecord } from './types';

type ListResult = {
  list: { id: string; name: string; isNew?: boolean; memberCount?: number };
  url: string;
  requested?: number;
  added?: number;
  queued?: boolean;
  jobId?: string | null;
};

const isListResult = (value: unknown): value is ListResult =>
  isRecord(value) &&
  isRecord(value.list) &&
  typeof value.list.id === 'string' &&
  typeof value.url === 'string';

/** the same tool call re-renders many times; the sidebar refresh runs once */
const refreshed = new Set<string>();

const useRefreshLists = (toolCallId: string, settled: boolean) => {
  const queryClient = useQueryClient();
  const router = useRouter();

  // once on landing, and once more when a queued job settles
  useEffect(() => {
    const key = `${toolCallId}:${settled}`;

    if (refreshed.has(key)) return;

    refreshed.add(key);
    void queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.lists] });
    void queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.entities] });
    void router.invalidate();
  }, [toolCallId, settled, queryClient, router]);
};

const noun = (input: unknown, count: number): string => {
  const kind =
    isRecord(input) && input.sourceKind === 'firm' ? 'firm' : 'adviser';

  return count === 1 ? kind : `${kind}s`;
};

export const listDetail = (result: unknown): string | null =>
  isListResult(result) ? result.list.name : null;

export const ListCard = ({
  result,
  toolCallId,
  input,
}: {
  result: unknown;
  toolCallId: string;
  input?: unknown;
}) => {
  const ok = isListResult(result);
  const job = useJob(ok && result.queued ? result.jobId : null);
  const settled = !ok || !result.queued || isJobSettled(job.data);

  useRefreshLists(toolCallId, settled);

  if (!ok) return null;

  const live = job.data;
  const meta = !result.queued
    ? result.list.memberCount === 0 && result.added === undefined
      ? 'Empty list'
      : `${(result.added ?? result.list.memberCount ?? 0).toLocaleString()} ${noun(input, result.added ?? 0)} added`
    : live?.status === 'completed'
      ? `${live.added.toLocaleString()} ${noun(input, live.added)} added`
      : live?.status === 'failed'
        ? 'The background add failed'
        : live && live.requested > 0
          ? `${live.processed.toLocaleString()} of ${live.requested.toLocaleString()} ${noun(input, live.requested)} added so far`
          : `${(result.requested ?? 0).toLocaleString()} ${noun(input, result.requested ?? 0)} · adding in the background`;
  const tag = result.list.isNew
    ? 'New list'
    : result.queued && !settled
      ? 'In progress'
      : live?.status === 'failed'
        ? 'Failed'
        : null;

  return (
    <ArtifactCard
      href={result.url}
      icon={<Icons.checklist size={16} />}
      meta={meta}
      tag={tag}
      title={result.list.name}
    />
  );
};

const summariseFilter = (filter: unknown): string[] => {
  if (!isRecord(filter)) return [];

  const lines: string[] = [];
  const groups: [string, string][] = [
    ['all', ''],
    ['any', 'any of: '],
    ['none', 'none of: '],
  ];

  for (const [group, prefix] of groups) {
    const conditions = filter[group];

    if (!Array.isArray(conditions) || conditions.length === 0) continue;

    lines.push(
      prefix +
        conditions
          .filter(isRecord)
          .map((c) => {
            const value = Array.isArray(c.value)
              ? c.value.join(', ')
              : c.value === undefined
                ? ''
                : String(c.value);

            return `${String(c.field)} ${String(c.op)} ${value}`.trim();
          })
          .join('; '),
    );
  }

  return lines;
};

export const describeAddToList = (input: unknown): ApprovalDescription => {
  if (!isRecord(input)) return { title: 'Add to list', lines: [] };

  const crds = Array.isArray(input.sourceCrds) ? input.sourceCrds : null;
  const total =
    typeof input.expectedTotal === 'number' ? input.expectedTotal : null;
  const count = crds ? crds.length : total;
  const target =
    typeof input.newListName === 'string'
      ? `a new list "${input.newListName}"`
      : typeof input.listName === 'string'
        ? `the list "${input.listName}"`
        : 'an existing list';
  const what =
    count === null
      ? `everything the search matched`
      : `${count.toLocaleString()} ${noun(input, count)}`;

  return {
    title:
      typeof input.newListName === 'string'
        ? 'Create list and add'
        : 'Add to list',
    lines: [
      `Add ${what} to ${target}.`,
      ...(crds
        ? []
        : summariseFilter(input.filter).map((line) => `Filter: ${line}`)),
      ...(crds
        ? []
        : [
            'Saving a filter runs in the background; the count settles shortly.',
          ]),
    ],
  };
};

export const describeCreateList = (input: unknown): ApprovalDescription => ({
  title: 'Create list',
  lines: [
    isRecord(input) && typeof input.name === 'string'
      ? `Create an empty ${noun(input, 2)} list called "${input.name}".`
      : 'Create an empty list.',
  ],
});
