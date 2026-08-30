import { useMutation, useQueryClient } from '@tanstack/react-query';

import { listsControllerCreateList } from '../../../api/generated/lists/lists';
import type { CreateList } from '../../../api/generated/rIAScoutAPI.schemas';
import { QUERY_KEYS } from '../../../lib/query';
import { toast } from '../../../ui/primitives/toast/toast';

export const useCreateList = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateList) => listsControllerCreateList(body),
    onSuccess: (list) => {
      toast.success(`Created ${list.name}`);
      void queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.lists] });
    },
    onError: () => toast.error('Could not create that list'),
  });
};
