import React from 'react';

import { Icons } from '../icons/base';
import { Box, Center } from '../primitives/layout';
import { Span } from '../primitives/text';
import { BoxProps, CenterProps } from '@riascout-ui/styled-system/jsx';
import { Token, token } from '@riascout-ui/styled-system/tokens';

type Props = { color: string } & BoxProps;

export const ColorDot = ({ color, style, ...rest }: Props) => {
  return (
    <Box
      h="2.5"
      rounded="50%"
      w="2.5"
      {...rest}
      style={{
        ...style,
        backgroundColor: token.var(`colors.user.solid.${color}` as Token),
      }}
    />
  );
};

export const ColorBadge = ({ color, style, ...rest }: Props) => {
  return (
    <Box
      bg="var(--color)"
      border="1px solid"
      borderColor="var(--color)/70"
      color="var(--text-color)"
      fontFamily="geistMono"
      fontSize="1"
      px="1"
      rounded="lg"
      style={
        {
          ...style,
          '--color': token(`colors.user.alpha.${color}` as Token),
          '--text-color': token(`colors.user.text.${color}` as Token),
        } as React.CSSProperties
      }
      {...rest}
    />
  );
};

export const ColorIconBox = ({
  color,
  ...rest
}: { color: string } & CenterProps) => {
  return (
    <Center
      bg="var(--color)"
      border="1px solid"
      borderColor="var(--color)/70"
      color="var(--text-color)"
      p="0.5"
      rounded="md"
      style={
        {
          '--color': token(`colors.user.alpha.${color}` as Token),
          '--text-color': token(`colors.user.text.${color}` as Token),
        } as React.CSSProperties
      }
      {...rest}
    />
  );
};

export const ReadOnlyModeBadge = () => {
  return (
    <ColorBadge
      alignItems="center"
      color="violet"
      display="flex"
      fontWeight="500"
      gap="1"
      rounded="full"
    >
      <Icons.lock />
      <Span>Read Only Mode</Span>
    </ColorBadge>
  );
};
