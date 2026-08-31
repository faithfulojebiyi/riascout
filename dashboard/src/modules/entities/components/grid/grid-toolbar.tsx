import { Link } from '@tanstack/react-router';
import { Flex } from '@riascout-ui/styled-system/jsx';

import { SaveToList } from '../../../lists/components/save-to-list';
import { Icons } from '../../../../ui/icons/base';
import { Button } from '../../../../ui/primitives/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../ui/primitives/dropdown-menu';
import { Span } from '../../../../ui/primitives/text';
import { useUpdateViewSort } from '../../mutations/use-view-field-mutations';
import type { EntityViewSummary } from '../../types/grid';
import { ViewSettingsMenu } from './view-settings-menu';

export type GridToolbarProps = {
  entityId: string;
  entitySlug: string;
  views: { id: string; name: string; isDefault: boolean }[];
  view: EntityViewSummary;
  /** market CRDs of the ticked rows, for a bulk action */
  selectedCrds: string[];
  onSortCleared: () => void;
};

export const GridToolbar = ({
  entityId,
  entitySlug,
  views,
  view,
  selectedCrds,
  onSortCleared,
}: GridToolbarProps) => {
  const updateSort = useUpdateViewSort();

  const activeSort = view.sort[0];
  const sortedField = activeSort
    ? view.fields.find(
        (field) => field.attributeId === activeSort.path[0]?.attributeId,
      )
    : undefined;

  const clearSort = () => {
    if (!activeSort) return;

    updateSort.mutate(
      {
        viewId: view.id,
        attributeId: activeSort.path[0]?.attributeId ?? '',
        direction: null,
      },
      { onSuccess: onSortCleared },
    );
  };

  return (
    // borderless drops the grid header's top edge, so the split lives here
    <Flex
      borderBottomWidth="1px"
      borderColor="brand.panel.4"
      direction="column"
    >
      <Flex align="center" gap="2" justify="space-between" px="3" py="2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Icons.grid />
              <Span>{view.name}</Span>
              <Icons.caretDown size={12} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" css={{ minW: '12rem' }}>
            {views.map((option) => (
              <DropdownMenuItem asChild key={option.id}>
                <Link
                  params={{ entitySlug }}
                  search={{ view: option.id }}
                  to="/$entitySlug"
                >
                  <Flex align="center" gap="2" w="full">
                    <Icons.entityList />
                    <Span flex="1">{option.name}</Span>
                    {option.id === view.id ? <Icons.check size={14} /> : null}
                  </Flex>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Flex align="center" gap="2">
          {selectedCrds.length > 0 ? (
            <>
              <Span color="text.muted" fontSize="2">
                {selectedCrds.length.toLocaleString()} selected
              </Span>
              <SaveToList entityId={entityId} sourceCrds={selectedCrds} />
            </>
          ) : null}
          <ViewSettingsMenu view={view} />
        </Flex>
      </Flex>

      {/* only present once there is something to show — an empty strip is noise */}
      {sortedField ? (
        <Flex align="center" gap="2" px="3" pb="2">
          <Flex
            align="center"
            borderColor="brand.panel.4"
            borderWidth="1px"
            gap="1.5"
            pl="2"
            pr="1"
            py="1"
            rounded="lg"
          >
            <Icons.sort size={12} />
            <Span color="text.muted" fontSize="1">
              Sorted by
            </Span>
            <Span fontSize="1" fontWeight="500">
              {sortedField.label}
            </Span>
            <Span color="text.muted" fontSize="1">
              {activeSort?.direction === 'asc' ? 'ascending' : 'descending'}
            </Span>
            <Button
              disabled={updateSort.isPending}
              onClick={clearSort}
              size="icon"
              variant="ghost"
            >
              <Icons.close size={12} />
            </Button>
          </Flex>
        </Flex>
      ) : null}
    </Flex>
  );
};
