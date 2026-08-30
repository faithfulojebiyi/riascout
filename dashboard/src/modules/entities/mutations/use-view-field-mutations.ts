import { useRouter } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';

import {
  entitiesControllerMoveViewField,
  entitiesControllerUpdateViewField,
  entitiesControllerUpdateViewSort,
} from '../../../api/generated/entities/entities';
import type {
  MoveViewField,
  UpdateViewField,
  UpdateViewSort,
} from '../../../api/generated/rIAScoutAPI.schemas';
import { toast } from '../../../ui/primitives/toast/toast';

/**
 * The view is loaded by the route, not by react-query, so a column change has
 * to invalidate the router rather than a query key — otherwise the header menu
 * writes and the grid keeps rendering the columns it was handed.
 */
const useViewMutation = <TBody, TResult>(
  fn: (body: TBody) => Promise<TResult>,
  errorMessage: string,
) => {
  const router = useRouter();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => router.invalidate(),
    onError: () => toast.error(errorMessage),
  });
};

export const useUpdateViewField = () =>
  useViewMutation(
    (body: UpdateViewField) => entitiesControllerUpdateViewField(body),
    'Could not update that column',
  );

export const useMoveViewField = () =>
  useViewMutation(
    (body: MoveViewField) => entitiesControllerMoveViewField(body),
    'Could not move that column',
  );

export const useUpdateViewSort = () =>
  useViewMutation(
    (body: UpdateViewSort) => entitiesControllerUpdateViewSort(body),
    'Could not sort by that column',
  );
