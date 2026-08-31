import type React from 'react';
import { Link } from '@tanstack/react-router';
import { Flex } from '@riascout-ui/styled-system/jsx';

import { Icons } from '../../../../ui/icons/base';
import { Button } from '../../../../ui/primitives/button';
import { Span } from '../../../../ui/primitives/text';

export type TopBarProps = {
  /** which target is being searched, for the heading beside the count */
  title: string;
  total: number | null;
  isFetching: boolean;
  /** save-to-list and any future bulk action */
  actions?: React.ReactNode;
  /** what the count is counting; "advisors" and "firms" read differently */
  noun: string;
};

/**
 * The Saved tab that used to sit here was permanently disabled — saved
 * prospects are what lists and saved views already are.
 */
export const TopBar = ({
  title,
  total,
  isFetching,
  actions,
  noun,
}: TopBarProps) => (
  /**
   * 2.75rem literally, matching FilterHeader in the rail — panda extracts these
   * statically, so a shared constant would emit no css. Height is fixed rather
   * than derived from padding, or the two rules only line up by coincidence.
   */
  <Flex
    align="center"
    borderBottomWidth="1px"
    borderColor="brand.panel.4"
    flexShrink="0"
    gap="3"
    minH="2.75rem"
    px="3"
  >
    <Button asChild variant="ghost">
      <Link to="/prospecting">
        <Icons.arrowLeft />
      </Link>
    </Button>

    <Span fontSize="2" fontWeight="600">
      {title}
    </Span>

    <Span color="text.muted" fontSize="2">
      {total === null ? '—' : `${total.toLocaleString()} ${noun}`}
    </Span>
    {isFetching ? (
      <Span color="text.placeholder" fontSize="2">
        Updating…
      </Span>
    ) : null}

    <Flex gap="2" ml="auto">
      {actions}
    </Flex>
  </Flex>
);
