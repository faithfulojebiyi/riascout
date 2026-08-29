import { useMutation } from '@tanstack/react-query';

import { entitiesControllerUpdateRecordValues } from '../../../api/generated/entities/entities';
import type {
  UpdateRecordValues,
  UpdateRecordValuesResponseResultsItem,
} from '../../../api/generated/rIAScoutAPI.schemas';
import { toast } from '../../../ui/primitives/toast/toast';

type ConflictBody = {
  code?: string;
  results?: UpdateRecordValuesResponseResultsItem[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * A version conflict arrives as a 409 whose body carries the per-cell results,
 * so the conflicting attributes are recoverable rather than just "it failed".
 */
export const conflictedAttributeIds = (error: unknown): string[] => {
  if (!isRecord(error)) return [];

  const response = isRecord(error.response) ? error.response : null;

  if (response?.status !== 409) return [];

  const body: ConflictBody = isRecord(response.data) ? response.data : {};

  return (body.results ?? [])
    .filter((r) => r.status === 'conflict')
    .map((r) => r.attributeId);
};

/**
 * The grid runs SSRM and ag-grid owns its block cache, so there is no
 * react-query cache to invalidate. The caller applies the value to the row node
 * optimistically and reverts from onError.
 */
export const useUpdateRecordValues = () =>
  useMutation({
    mutationFn: (body: UpdateRecordValues) =>
      entitiesControllerUpdateRecordValues(body),
    onError: (error) => {
      const conflicts = conflictedAttributeIds(error);

      if (conflicts.length > 0) {
        toast.error('That cell changed while you were editing', {
          description:
            'Your edit was not saved. Refresh to see the current value.',
        });

        return;
      }

      const status =
        isRecord(error) && isRecord(error.response)
          ? error.response.status
          : null;

      toast.error(
        status === 403
          ? 'This column comes from market data and cannot be edited'
          : 'Could not save that edit',
      );
    },
  });
