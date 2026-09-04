import { useNavigate } from '@tanstack/react-router';
import type { MouseEvent, ReactNode } from 'react';

import { Box, Flex, HStack, styled } from '@riascout-ui/styled-system/jsx';

import { Icons } from '../../../../ui/icons/base';

/** in-app paths come from tool output as strings, query string included */
export const useOpenHref = () => {
  const navigate = useNavigate();

  return (href: string) => (event: MouseEvent) => {
    event.preventDefault();
    void navigate({ href });
  };
};

/**
 * The house card for something the assistant produced: a two-layer frame, an
 * icon tile, a title, a meta row, and a caret. The whole card is the link.
 */
export const ArtifactCard = ({
  href,
  icon,
  title,
  meta,
  tag,
  children,
}: {
  href: string | null;
  icon: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  tag?: ReactNode;
  children?: ReactNode;
}) => {
  const open = useOpenHref();
  const body = (
    <Flex
      alignItems="center"
      bg="brand.panel.4"
      gap="3"
      px="3"
      py="2.5"
      rounded="xl"
    >
      <Flex
        alignItems="center"
        bg="brand.panel.5"
        color="text.app"
        flexShrink="0"
        justifyContent="center"
        p="2"
        rounded="md"
      >
        {icon}
      </Flex>
      <Box flex="1" minW="0">
        <HStack gap="2" minW="0">
          <styled.span
            fontSize="1"
            fontWeight="500"
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
          >
            {title}
          </styled.span>
          {tag ? (
            <styled.span
              bg="brand.panel.6"
              color="text.muted"
              flexShrink="0"
              fontSize="0.688"
              px="1.5"
              py="0.5"
              rounded="full"
            >
              {tag}
            </styled.span>
          ) : null}
        </HStack>
        {meta ? (
          <styled.div
            color="text.muted"
            fontSize="0.688"
            mt="0.5"
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
          >
            {meta}
          </styled.div>
        ) : null}
      </Box>
      {href ? (
        <Box color="text.muted" flexShrink="0">
          <Icons.caretRight size={14} />
        </Box>
      ) : null}
    </Flex>
  );

  return (
    <Box my="2">
      <styled.a
        bg="background.app"
        borderColor="brand.panel.6"
        borderWidth="1px"
        boxShadow="0 1px 2px rgba(10, 18, 23, 0.06), 0 6px 20px rgba(10, 18, 23, 0.06)"
        cursor={href ? 'pointer' : 'default'}
        display="block"
        href={href ?? undefined}
        onClick={href ? open(href) : undefined}
        p="1"
        rounded="2xl"
        textDecoration="none"
        transition="border-color 120ms, box-shadow 120ms"
        _hover={
          href
            ? {
                borderColor: 'brand.primary.9',
                boxShadow: '0 0 0 2px token(colors.brand.primary.4)',
              }
            : {}
        }
      >
        {body}
        {children}
      </styled.a>
    </Box>
  );
};
