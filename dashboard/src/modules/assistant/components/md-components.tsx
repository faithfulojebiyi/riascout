import type { ComponentProps } from 'react';

import { styled } from '@riascout-ui/styled-system/jsx';

/**
 * Streamdown renders semantic html; these overrides give it the app's type
 * scale and surfaces so an answer reads like the rest of the page, not like a
 * pasted document. Tables become tiles: each cell is its own panel and the
 * page background does the work of gridlines.
 */
const Paragraph = (props: ComponentProps<'p'>) => (
  <styled.p lineHeight="1.6" my="2" {...props} />
);

const Strong = (props: ComponentProps<'strong'>) => (
  <styled.strong fontWeight="600" {...props} />
);

const Emphasis = (props: ComponentProps<'em'>) => (
  <styled.em fontStyle="italic" {...props} />
);

const Anchor = (props: ComponentProps<'a'>) => (
  <styled.a
    color="text.app"
    rel="noreferrer"
    target="_blank"
    textDecoration="underline"
    textDecorationColor="brand.panel.30"
    textUnderlineOffset="3px"
    _hover={{ textDecorationColor: 'brand.panel.60' }}
    {...props}
  />
);

const UnorderedList = (props: ComponentProps<'ul'>) => (
  <styled.ul listStyleType="disc" my="2" pl="5" {...props} />
);

const OrderedList = (props: ComponentProps<'ol'>) => (
  <styled.ol listStyleType="decimal" my="2" pl="5" {...props} />
);

const ListItem = (props: ComponentProps<'li'>) => (
  <styled.li lineHeight="1.6" my="1" {...props} />
);

const heading = (as: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') => {
  const Tag = styled[as];

  // answers are conversational: every heading level renders at body scale
  return (props: ComponentProps<'h1'>) => (
    <Tag fontSize="1" fontWeight="600" mb="1" mt="4" {...props} />
  );
};

const InlineCode = (props: ComponentProps<'code'>) => (
  <styled.code
    bg="brand.panel.5"
    fontFamily="mono"
    fontSize="0.85em"
    px="1.5"
    py="0.5"
    rounded="md"
    {...props}
  />
);

const Pre = (props: ComponentProps<'pre'>) => (
  <styled.pre
    bg="brand.panel.4"
    fontFamily="mono"
    fontSize="1"
    lineHeight="1.6"
    my="3"
    overflowX="auto"
    p="3"
    rounded="lg"
    {...props}
  />
);

const Blockquote = (props: ComponentProps<'blockquote'>) => (
  <styled.blockquote
    borderLeftColor="brand.panel.15"
    borderLeftWidth="2px"
    color="text.muted"
    my="3"
    pl="3"
    {...props}
  />
);

const Rule = (props: ComponentProps<'hr'>) => (
  <styled.hr borderColor="brand.panel.10" my="4" {...props} />
);

const Table = (props: ComponentProps<'table'>) => (
  <styled.table
    borderCollapse="separate"
    css={{ borderSpacing: '3px' }}
    display="block"
    fontSize="1"
    my="3"
    overflowX="auto"
    w="full"
    {...props}
  />
);

const HeaderCell = (props: ComponentProps<'th'>) => (
  <styled.th
    bg="brand.panel.6"
    color="text.muted"
    fontWeight="500"
    px="2.5"
    py="1.5"
    rounded="md"
    textAlign="left"
    whiteSpace="nowrap"
    {...props}
  />
);

const Cell = (props: ComponentProps<'td'>) => (
  <styled.td bg="brand.panel.3" px="2.5" py="1.5" rounded="md" {...props} />
);

export const mdComponents = {
  a: Anchor,
  blockquote: Blockquote,
  code: InlineCode,
  em: Emphasis,
  h1: heading('h1'),
  h2: heading('h2'),
  h3: heading('h3'),
  h4: heading('h4'),
  h5: heading('h5'),
  h6: heading('h6'),
  hr: Rule,
  li: ListItem,
  ol: OrderedList,
  p: Paragraph,
  pre: Pre,
  strong: Strong,
  table: Table,
  td: Cell,
  th: HeaderCell,
  ul: UnorderedList,
};
