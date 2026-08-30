import { useState, type KeyboardEvent } from 'react';
import { Flex, HStack } from '@riascout-ui/styled-system/jsx';

import { Icons } from '../../../../ui/icons/base';
import { Button } from '../../../../ui/primitives/button';
import type { IHeaderParams } from '../../../../ui/primitives/data-grid';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../ui/primitives/dropdown-menu';
import { Input } from '../../../../ui/primitives/input';
import { Span } from '../../../../ui/primitives/text';
import {
  useMoveViewField,
  useUpdateViewField,
  useUpdateViewSort,
} from '../../mutations/use-view-field-mutations';
import type { EntityViewField } from '../../types/grid';
import { attributeIcon } from './attribute-icon';

export type GridColumnHeaderProps = IHeaderParams & {
  field: EntityViewField;
  viewId: string;
  sortDirection: 'asc' | 'desc' | null;
};

const MENU_ITEM = {
  justifyContent: 'flex-start',
  size: 'sm',
  variant: 'ghost',
  w: 'full',
} as const;

/**
 * Replaces ag-grid's header entirely. Its built-in menu offers pinning,
 * autosize and "choose columns" — none of which persist to the view, so a user
 * rearranges the grid and loses it on reload.
 */
export const GridColumnHeader = (props: GridColumnHeaderProps) => {
  const { field, viewId, sortDirection } = props;

  const [renaming, setRenaming] = useState(false);
  const [label, setLabel] = useState(field.label);

  const updateField = useUpdateViewField();
  const moveField = useMoveViewField();
  const updateSort = useUpdateViewSort();

  const Icon = attributeIcon(field.icon, field.type);

  // the rows are already ordered by the server, so a new sort must refetch them
  const refetchRows = () => props.api.refreshServerSide({ purge: true });

  const sort = (direction: 'asc' | 'desc') => {
    updateSort.mutate(
      {
        viewId,
        attributeId: field.attributeId,
        direction: sortDirection === direction ? null : direction,
      },
      { onSuccess: refetchRows },
    );
  };

  const commitRename = () => {
    setRenaming(false);

    if (label.trim() === '' || label === field.label) {
      setLabel(field.label);

      return;
    }

    updateField.mutate({ viewId, fieldId: field.fieldId, label: label.trim() });
  };

  const onRenameKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') commitRename();

    if (event.key === 'Escape') {
      setLabel(field.label);
      setRenaming(false);
    }
  };

  if (renaming) {
    return (
      <Input
        autoFocus
        onBlur={commitRename}
        onChange={(event) => setLabel(event.target.value)}
        onKeyDown={onRenameKey}
        size="xs"
        value={label}
      />
    );
  }

  return (
    <Flex
      _hover={{ '& .column-menu': { opacity: '1' } }}
      align="center"
      gap="1"
      justify="space-between"
      w="full"
    >
      <HStack flex="1" gap="1.5" minW="0">
        <Span color="text.muted" flexShrink="0">
          <Icon />
        </Span>
        <Span
          fontSize="1"
          fontWeight="500"
          overflow="hidden"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
        >
          {field.label}
        </Span>
        {sortDirection ? (
          <Span color="text.muted" flexShrink="0">
            {sortDirection === 'asc' ? (
              <Icons.arrowUp size={12} />
            ) : (
              <Icons.arrowDown size={12} />
            )}
          </Span>
        ) : null}
      </HStack>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="column-menu"
            flexShrink="0"
            opacity={sortDirection ? '1' : '0'}
            size="icon"
            transition="opacity 200ms"
            variant="ghost"
          >
            <Icons.ellipsis />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" css={{ minW: '13rem' }} p="1">
          <DropdownMenuItem asChild onSelect={() => sort('asc')}>
            <Button {...MENU_ITEM}>
              <Icons.arrowUp />
              <Span>Sort ascending</Span>
            </Button>
          </DropdownMenuItem>
          <DropdownMenuItem asChild onSelect={() => sort('desc')}>
            <Button {...MENU_ITEM}>
              <Icons.arrowDown />
              <Span>Sort descending</Span>
            </Button>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            asChild
            onSelect={() =>
              moveField.mutate({
                viewId,
                fieldId: field.fieldId,
                direction: 'left',
              })
            }
          >
            <Button {...MENU_ITEM}>
              <Icons.arrowLeft />
              <Span>Move left</Span>
            </Button>
          </DropdownMenuItem>
          <DropdownMenuItem
            asChild
            onSelect={() =>
              moveField.mutate({
                viewId,
                fieldId: field.fieldId,
                direction: 'right',
              })
            }
          >
            <Button {...MENU_ITEM}>
              <Icons.arrowRight />
              <Span>Move right</Span>
            </Button>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild onSelect={() => setRenaming(true)}>
            <Button {...MENU_ITEM}>
              <Icons.editLine />
              <Span>Edit column label</Span>
            </Button>
          </DropdownMenuItem>
          <DropdownMenuItem
            asChild
            onSelect={() =>
              updateField.mutate({
                viewId,
                fieldId: field.fieldId,
                isVisible: false,
              })
            }
          >
            <Button {...MENU_ITEM}>
              <Icons.eyeSlash />
              <Span>Hide from view</Span>
            </Button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Flex>
  );
};
