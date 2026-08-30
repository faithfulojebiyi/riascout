import { Box, Flex, VStack } from '@riascout-ui/styled-system/jsx';

import { Span } from '../../../ui/primitives/text';

const Bar = ({ w }: { w: string }) => (
  <Box bg="background.muted" h="0.5rem" rounded="sm" w={w} />
);

const ROW_COUNT = 14;

/**
 * A wireframe rather than a screenshot: it has to stay honest as the grid
 * changes, and nobody should be shown data before they have a workspace.
 */
export const ProductPreview = ({
  workspaceName,
}: {
  workspaceName: string;
}) => (
  <Box
    borderColor="border.subtle"
    borderRadius="xl"
    borderWidth="1px"
    overflow="hidden"
    w="full"
  >
    <Flex align="stretch" minH="24rem">
      <VStack
        alignItems="stretch"
        borderColor="border.subtle"
        borderRightWidth="1px"
        gap="3"
        p="3"
        w="11rem"
      >
        <Flex align="center" gap="2">
          <Box bg="brand.primary.9" h="1rem" rounded="sm" w="1rem" />
          <Span
            fontSize="1"
            fontWeight="500"
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
          >
            {workspaceName}
          </Span>
        </Flex>

        <Box bg="background.muted" h="1.5rem" rounded="md" />

        <VStack alignItems="stretch" gap="2.5">
          <Bar w="70%" />
          <Bar w="55%" />
          <Bar w="62%" />
          <Bar w="45%" />
        </VStack>
      </VStack>

      <VStack alignItems="stretch" flex="1" gap="0" minW="0" p="3">
        <Flex gap="2" pb="3">
          <Box bg="background.muted" h="1.5rem" rounded="md" w="6rem" />
          <Box bg="background.muted" h="1.5rem" rounded="md" w="4rem" />
        </Flex>

        {Array.from({ length: ROW_COUNT }, (_, index) => (
          <Flex
            align="center"
            borderColor="border.subtle"
            borderTopWidth="1px"
            gap="3"
            key={index}
            py="2"
          >
            <Box
              bg="background.muted"
              flexShrink="0"
              h="0.75rem"
              rounded="full"
              w="0.75rem"
            />
            <Bar w={`${40 + ((index * 7) % 35)}%`} />
            <Bar w="18%" />
          </Flex>
        ))}
      </VStack>
    </Flex>
  </Box>
);
