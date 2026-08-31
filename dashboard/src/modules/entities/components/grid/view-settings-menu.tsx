import { useEffect, useState } from 'react';
import { Flex } from '@riascout-ui/styled-system/jsx';

import { Icons } from '../../../../ui/icons/base';
import { Button } from '../../../../ui/primitives/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../../../../ui/primitives/dropdown-menu';
import { SortableList } from '../../../../ui/primitives/sortable-lists';
import { Span } from '../../../../ui/primitives/text';
import {
  useMoveViewField,
  useUpdateViewField,
} from '../../mutations/use-view-field-mutations';
import type { EntityViewField, EntityViewSummary } from '../../types/grid';
import { attributeIcon } from './attribute-icon';
import { orderedVisibleFields, pinnedCount } from './field-order';

export type ViewSettingsMenuProps = { view: EntityViewSummary };

const UNGROUPED = 'Other';

type Row = EntityViewField & { id: string };

/** hidden columns, bucketed by the attribute group so the submenu is navigable */
const groupHidden = (
  fields: EntityViewField[],
): [string, EntityViewField[]][] =>
  [
    ...fields
      .filter((field) => !field.isVisible)
      .reduce((groups, field) => {
        const key = field.group ?? UNGROUPED;

        return groups.set(key, [...(groups.get(key) ?? []), field]);
      }, new Map<string, EntityViewField[]>()),
  ].sort(([a], [b]) => a.localeCompare(b));

export const ViewSettingsMenu = ({ view }: ViewSettingsMenuProps) => {
  const updateField = useUpdateViewField();
  const moveField = useMoveViewField();

  const visible = orderedVisibleFields(view.fields);
  const locked = pinnedCount(view.fields);

  /**
   * Local order so the row follows the cursor; the server rank comes back on
   * the next load. Resynced from the view, or a drop would be reverted by the
   * refetch it triggers.
   */
  const [rows, setRows] = useState<Row[]>(() =>
    visible.map((field) => ({ ...field, id: field.fieldId })),
  );

  useEffect(() => {
    setRows(visible.map((field) => ({ ...field, id: field.fieldId })));
  }, [view.fields]);

  const hiddenGroups = groupHidden(view.fields);
  const hiddenCount = view.fields.length - visible.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Icons.columns />
          <Span>View settings</Span>
          <Icons.caretDown size={12} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" css={{ minW: '14rem' }}>
        <DropdownMenuLabel>View settings</DropdownMenuLabel>

        <SortableList
          items={rows}
          onChange={setRows}
          onDragEndCallback={(_items, index) => {
            const moved = _items[index];

            // never above the pinned block — the grid would render it there anyway
            if (moved) {
              moveField.mutate({
                viewId: view.id,
                fieldId: moved.fieldId,
                toIndex: Math.max(index, locked),
              });
            }
          }}
          renderItem={(row) => (
            <SortableList.Item disabled={row.isPinned} id={row.id}>
              <ColumnRow
                canHide={rows.length > 1}
                field={row}
                onHide={() =>
                  updateField.mutate({
                    viewId: view.id,
                    fieldId: row.fieldId,
                    isVisible: false,
                  })
                }
                onMove={(direction) =>
                  moveField.mutate({
                    viewId: view.id,
                    fieldId: row.fieldId,
                    direction,
                  })
                }
              />
            </SortableList.Item>
          )}
        />

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Flex align="center" gap="2" w="full">
              <Icons.add />
              <Span flex="1">Add column</Span>
              <Span color="text.placeholder" fontSize="1">
                {hiddenCount}
              </Span>
            </Flex>
          </DropdownMenuSubTrigger>

          <DropdownMenuSubContent css={{ maxH: '24rem', minW: '14rem' }}>
            {hiddenGroups.length === 0 ? (
              <DropdownMenuItem disabled>
                <Span>Every column is already shown</Span>
              </DropdownMenuItem>
            ) : (
              hiddenGroups.map(([group, fields]) => (
                <DropdownMenuSub key={group}>
                  <DropdownMenuSubTrigger>
                    <Flex align="center" gap="2" w="full">
                      <Span flex="1">{group}</Span>
                      <Span color="text.placeholder" fontSize="1">
                        {fields.length}
                      </Span>
                    </Flex>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent
                    css={{ maxH: '24rem', minW: '14rem', overflowY: 'auto' }}
                  >
                    {fields.map((field) => {
                      const Icon = attributeIcon(field.icon, field.type);

                      return (
                        <DropdownMenuItem
                          key={field.fieldId}
                          onSelect={() =>
                            updateField.mutate({
                              viewId: view.id,
                              fieldId: field.fieldId,
                              isVisible: true,
                            })
                          }
                        >
                          <Flex align="center" gap="2" minW="0">
                            <Span color="text.muted" flexShrink="0">
                              <Icon />
                            </Span>
                            <Span
                              overflow="hidden"
                              textOverflow="ellipsis"
                              whiteSpace="nowrap"
                            >
                              {field.label}
                            </Span>
                          </Flex>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

type ColumnRowProps = {
  field: EntityViewField;
  canHide: boolean;
  onHide: () => void;
  onMove: (direction: 'left' | 'right') => void;
};

/**
 * The grip, icon and label are inert — only the ellipsis opens the submenu, so
 * running the cursor down the list does not fire a menu per row. The row is one
 * hover target, grip included.
 */
const ColumnRow = ({ field, canHide, onHide, onMove }: ColumnRowProps) => {
  const Icon = attributeIcon(field.icon, field.type);

  return (
    <Flex
      _hover={{ '& .row-menu': { opacity: '1' }, bg: 'background.muted' }}
      align="center"
      gap="1.5"
      minW="0"
      pr="1"
      py="0.5"
      rounded="lg"
    >
      <SortableList.DragHandle
        css={{ color: 'text.placeholder', h: '5', px: '0', w: '4' }}
      />

      <Span color="text.muted" flexShrink="0">
        <Icon />
      </Span>
      <Span
        flex="1"
        fontSize="1"
        overflow="hidden"
        textOverflow="ellipsis"
        whiteSpace="nowrap"
      >
        {field.label}
      </Span>

      <DropdownMenuSub>
        <DropdownMenuSubTrigger
          className="row-menu"
          css={{
            color: 'text.placeholder',
            flexShrink: '0',
            opacity: '0',
            px: '0.5',
            transition: 'opacity 150ms',
          }}
          hideCaret
        >
          <Icons.ellipsisVertical size={14} />
        </DropdownMenuSubTrigger>

        <DropdownMenuSubContent css={{ minW: '11rem' }}>
          <DropdownMenuItem onSelect={() => onMove('left')}>
            <Flex align="center" gap="2">
              <Icons.arrowLeft />
              <Span>Move left</Span>
            </Flex>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onMove('right')}>
            <Flex align="center" gap="2">
              <Icons.arrowRight />
              <Span>Move right</Span>
            </Flex>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem disabled={!canHide} onSelect={onHide}>
            <Flex align="center" gap="2">
              <Icons.eyeSlash />
              <Span>Hide from view</Span>
            </Flex>
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </Flex>
  );
};
