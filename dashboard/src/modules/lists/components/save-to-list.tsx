import { useState } from 'react';
import { Flex } from '@riascout-ui/styled-system/jsx';

import type { AddToList } from '../../../api/generated/rIAScoutAPI.schemas';
import { Button } from '../../../ui/primitives/button';
import { Input } from '../../../ui/primitives/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../ui/primitives/popover';
import { Span } from '../../../ui/primitives/text';
import { useAddToList } from '../mutations/use-add-to-list';
import { useCreateList } from '../mutations/use-create-list';
import { useFetchLists } from '../queries/use-fetch-lists';

export type SaveToListProps = {
  entityId: string | null;
  /** market CRDs of the selected rows */
  sourceCrds: string[];
  /** set when saving everything the filter matches rather than the selection */
  allFilter?: AddToList['filter'];
  matchingTotal?: number;
};

export const SaveToList = ({
  entityId,
  sourceCrds,
  allFilter,
  matchingTotal,
}: SaveToListProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const listsQuery = useFetchLists(entityId);
  const addToList = useAddToList();
  const createList = useCreateList();

  const lists = listsQuery.data?.lists ?? [];
  const savingAll = sourceCrds.length === 0 && allFilter !== undefined;
  const disabled = sourceCrds.length === 0 && !savingAll;

  const addTo = (listId: string) => {
    // a filter saves everything it matches; ids save exactly what was ticked
    addToList.mutate(
      savingAll ? { listId, filter: allFilter } : { listId, sourceCrds },
    );
    setOpen(false);
  };

  const createAndAdd = async () => {
    if (!entityId || name.trim() === '') return;

    const list = await createList.mutateAsync({ entityId, name: name.trim() });

    setName('');
    addTo(list.id);
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button disabled={disabled} size="sm">
          {savingAll
            ? `Save all ${(matchingTotal ?? 0).toLocaleString()} to list`
            : `Save ${sourceCrds.length > 0 ? sourceCrds.length : ''} to list`}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <Flex direction="column" gap="1" maxH="64" overflowY="auto">
          {lists.map((list) => (
            <Button
              justifyContent="space-between"
              key={list.id}
              onClick={() => addTo(list.id)}
              size="sm"
              variant="ghost"
            >
              <Span>{list.name}</Span>
              <Span color="text.placeholder" fontSize="1">
                {list.memberCount}
              </Span>
            </Button>
          ))}
          {lists.length === 0 ? (
            <Span color="text.placeholder" fontSize="2" py="1">
              No lists yet
            </Span>
          ) : null}
        </Flex>

        <Flex
          borderColor="border.subtle"
          borderTopWidth="1px"
          gap="2"
          mt="2"
          pt="2"
        >
          <Input
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && void createAndAdd()}
            placeholder="New list name"
            value={name}
          />
          <Button
            disabled={name.trim() === ''}
            onClick={() => void createAndAdd()}
            size="sm"
          >
            Create
          </Button>
        </Flex>
      </PopoverContent>
    </Popover>
  );
};
