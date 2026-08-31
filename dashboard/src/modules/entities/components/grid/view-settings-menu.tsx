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
import { Span } from '../../../../ui/primitives/text';
import {
  useMoveViewField,
  useUpdateViewField,
} from '../../mutations/use-view-field-mutations';
import type { EntityViewField, EntityViewSummary } from '../../types/grid';
import { attributeIcon } from './attribute-icon';

export type ViewSettingsMenuProps = { view: EntityViewSummary };

const UNGROUPED = 'Other';

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

  const visible = view.fields.filter((field) => field.isVisible);
  const hiddenGroups = groupHidden(view.fields);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <Icons.columns />
          <Span>View settings</Span>
          <Icons.caretDown size={12} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" css={{ minW: '17rem' }}>
        <DropdownMenuLabel>View settings</DropdownMenuLabel>

        {visible.map((field) => {
          const Icon = attributeIcon(field.icon, field.type);
          // the grid cannot render a row with no columns at all
          const isLast = visible.length === 1;

          return (
            <DropdownMenuSub key={field.fieldId}>
              <DropdownMenuSubTrigger>
                <Flex align="center" gap="2" minW="0" w="full">
                  <Span color="text.muted" flexShrink="0">
                    <Icon />
                  </Span>
                  <Span
                    flex="1"
                    fontSize="2"
                    overflow="hidden"
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                  >
                    {field.label}
                  </Span>
                </Flex>
              </DropdownMenuSubTrigger>

              <DropdownMenuSubContent css={{ minW: '11rem' }}>
                <DropdownMenuItem
                  onSelect={() =>
                    moveField.mutate({
                      viewId: view.id,
                      fieldId: field.fieldId,
                      direction: 'left',
                    })
                  }
                >
                  <Flex align="center" gap="2">
                    <Icons.arrowLeft />
                    <Span>Move left</Span>
                  </Flex>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    moveField.mutate({
                      viewId: view.id,
                      fieldId: field.fieldId,
                      direction: 'right',
                    })
                  }
                >
                  <Flex align="center" gap="2">
                    <Icons.arrowRight />
                    <Span>Move right</Span>
                  </Flex>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  disabled={isLast}
                  onSelect={() =>
                    updateField.mutate({
                      viewId: view.id,
                      fieldId: field.fieldId,
                      isVisible: false,
                    })
                  }
                >
                  <Flex align="center" gap="2">
                    <Icons.eyeSlash />
                    <Span>Hide from view</Span>
                  </Flex>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          );
        })}

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Flex align="center" gap="2" w="full">
              <Icons.add />
              <Span flex="1">Add column</Span>
              <Span color="text.placeholder" fontSize="1">
                {view.fields.length - visible.length}
              </Span>
            </Flex>
          </DropdownMenuSubTrigger>

          <DropdownMenuSubContent css={{ maxH: '24rem', minW: '15rem' }}>
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
