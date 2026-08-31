import { Box, Flex, HStack } from '@riascout-ui/styled-system/jsx';

import { ColorIconBox } from '../../../../ui/blocks/colored-elements';
import type { TIcon } from '../../../../ui/icons/types';
import { Badge } from '../../../../ui/primitives/badge';
import { Skeleton } from '../../../../ui/primitives/skeleton';
import { Span, Text } from '../../../../ui/primitives/text';

export type TargetCardProps = {
  icon: TIcon;
  title: string;
  description: string;
  /** null while the count is loading; not rendered at all when unavailable */
  count: number | null;
  noun: string;
  /** a USER_COLORS name; drives the tile tint and the icon colour together */
  color: string;
  available: boolean;
  onSelect: () => void;
};

/**
 * Pointer events are removed rather than the card greyed and still clickable —
 * a target with no projection behind it must not be reachable at all.
 */
export const TargetCard = ({
  icon: Icon,
  title,
  description,
  count,
  noun,
  color,
  available,
  onSelect,
}: TargetCardProps) => (
  <Flex
    _hover={available ? { borderColor: 'brand.primary.8' } : undefined}
    align="center"
    borderColor="brand.panel.4"
    borderRadius="2xl"
    borderWidth="1px"
    cursor={available ? 'pointer' : 'not-allowed'}
    gap="3"
    onClick={available ? onSelect : undefined}
    opacity={available ? '1' : '0.6'}
    p="2.5"
    pointerEvents={available ? 'auto' : 'none'}
    role={available ? 'button' : undefined}
    textAlign="left"
    transition="border-color 200ms"
    w="full"
  >
    <ColorIconBox
      color={color}
      flexShrink="0"
      h="2.75rem"
      rounded="xl"
      w="2.75rem"
    >
      <Icon size={20} />
    </ColorIconBox>

    <Box flex="1" minW="0">
      <HStack gap="2">
        <Text fontSize="2" fontWeight="500">
          {title}
        </Text>
        {available ? null : (
          <Badge colorPalette="brand.info" look="soft" size="xs">
            Soon
          </Badge>
        )}
      </HStack>

      <Text color="text.muted" fontSize="1" mt="0.5">
        {description}
      </Text>

      {available ? (
        count === null ? (
          <Skeleton h="0.75rem" mt="1" rounded="md" w="6rem" />
        ) : (
          <Span color="text.placeholder" fontSize="1">
            {count.toLocaleString()} {noun}
          </Span>
        )
      ) : null}
    </Box>
  </Flex>
);
