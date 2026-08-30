import type { ReactNode } from 'react';
import { Box, Flex, VStack } from '@riascout-ui/styled-system/jsx';

import { Heading, Span, Text } from '../../../ui/primitives/text';

export type AuthShellProps = {
  /** the form column */
  children: ReactNode;
  /** the right pane: marketing copy on sign-in, a product preview in onboarding */
  aside?: ReactNode;
  /** onboarding only — a way out of a half-finished account */
  onSignOut?: () => void;
};

const FOOTER_LINKS = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Support', href: '/support' },
];

/**
 * Logo above a single bordered card, the card split into a form column and an
 * aside. Every auth and onboarding screen is this shell with different
 * contents, so the card never moves between steps.
 */
export const AuthShell = ({ children, aside, onSignOut }: AuthShellProps) => (
  <VStack
    bg="background.app"
    gap="0"
    justifyContent="space-between"
    minH="100dvh"
    px="4"
    py="8"
  >
    <Heading as="h1" fontSize="6" fontWeight="600" letterSpacing="tight">
      RIAScout
    </Heading>

    <Box
      borderColor="border.subtle"
      borderRadius="2xl"
      borderWidth="1px"
      maxW="70.625rem"
      minH="43.25rem"
      my="8"
      w="full"
    >
      <Flex
        align="stretch"
        direction={{ base: 'column', md: 'row' }}
        gap="8"
        minH="43.25rem"
        p={{ base: '6', md: '12' }}
      >
        <Flex align="center" flex="1" justify="center">
          <Box maxW="26.25rem" w="full">
            {children}
          </Box>
        </Flex>

        {aside ? (
          <Flex align="center" flex="1" justify="center" minW="0">
            {aside}
          </Flex>
        ) : null}
      </Flex>
    </Box>

    <Flex align="center" gap="4" justify="center">
      <Span color="text.placeholder" fontSize="2">
        © {new Date().getFullYear()} RIAScout
      </Span>
      {FOOTER_LINKS.map((link) => (
        <Text
          asChild
          color="text.muted"
          fontSize="2"
          key={link.href}
          textDecoration="underline"
        >
          <a href={link.href}>{link.label}</a>
        </Text>
      ))}
      {onSignOut ? (
        <Text
          asChild
          color="text.muted"
          fontSize="2"
          textDecoration="underline"
        >
          <button onClick={onSignOut} type="button">
            Sign out
          </button>
        </Text>
      ) : null}
    </Flex>
  </VStack>
);

/** the right pane on sign-in: what this is, before anyone has seen it */
export const WelcomeAside = () => (
  <VStack alignItems="flex-start" gap="4" maxW="32rem">
    <Heading as="h2" fontSize="7" fontWeight="600" letterSpacing="tight">
      Welcome to RIAScout.
    </Heading>
    <Text color="text.muted">
      Every SEC-registered advisory firm and the 510,725 advisors who work at
      them, with the moves between them tracked as they happen.
    </Text>
    <Text color="text.muted">
      Filter by state, credential, tenure or AUM band, save a shortlist, and
      work it as a pipeline.
    </Text>
    <Text color="text.muted">Let us begin</Text>
  </VStack>
);
