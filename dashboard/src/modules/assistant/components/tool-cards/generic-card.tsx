import { useState } from 'react';

import { Box, styled } from '@riascout-ui/styled-system/jsx';

/** the fallback for a tool with no renderer: the payload behind a toggle */
export const GenericCard = ({ result }: { result: unknown }) => {
  const [open, setOpen] = useState(false);

  if (result === undefined || result === null) return null;

  return (
    <Box my="1">
      <styled.button
        color="text.muted"
        cursor="pointer"
        fontSize="0.688"
        onClick={() => setOpen((v) => !v)}
        textDecoration="underline"
        textUnderlineOffset="3px"
        type="button"
      >
        {open ? 'Hide result' : 'Show result'}
      </styled.button>
      {open ? (
        <styled.pre
          bg="brand.panel.3"
          fontSize="0.688"
          maxH="16rem"
          mt="1"
          overflow="auto"
          p="2"
          rounded="md"
        >
          {JSON.stringify(result, null, 2)}
        </styled.pre>
      ) : null}
    </Box>
  );
};
