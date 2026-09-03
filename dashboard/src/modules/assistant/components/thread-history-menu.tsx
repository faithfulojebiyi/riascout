import { useNavigate } from '@tanstack/react-router';

import { Box, HStack, styled } from '@riascout-ui/styled-system/jsx';

import { Icons } from '../../../ui/icons/base';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../ui/primitives/dropdown-menu';
import { useThreads, type ThreadSummary } from '../queries/use-threads';
import { DAY_GROUPS, dayGroup, relativeTime } from '../relative-time';

const groupThreads = (threads: ThreadSummary[]) => {
  const groups = new Map<string, ThreadSummary[]>();

  for (const thread of threads) {
    const key = dayGroup(thread.updatedAt);

    groups.set(key, [...(groups.get(key) ?? []), thread]);
  }

  return DAY_GROUPS.flatMap((name) => {
    const items = groups.get(name);

    return items ? [{ name, items }] : [];
  });
};

/**
 * The thread title doubles as the way into chat history: click it, get a
 * menu with a new-chat action and past conversations grouped by day.
 */
export const ThreadHistoryMenu = ({
  activeThreadId,
  title,
}: {
  activeThreadId: string;
  title: string;
}) => {
  const navigate = useNavigate();
  const { data } = useThreads();
  const groups = groupThreads(data ?? []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* fixed width: the title never resizes the trigger, it truncates */}
        <styled.button
          alignItems="center"
          bg="transparent"
          color="text.app"
          cursor="pointer"
          display="flex"
          fontSize="1"
          fontWeight="500"
          gap="1.5"
          h="7"
          px="2"
          rounded="lg"
          textAlign="left"
          type="button"
          w="240px"
          _hover={{ bg: 'brand.panel.4' }}
          css={{ '&[data-state=open]': { bg: 'brand.panel.4' } }}
        >
          <styled.span
            flex="1"
            minW="0"
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
          >
            {title}
          </styled.span>
          <Icons.caretDown size={12} style={{ flexShrink: 0 }} />
        </styled.button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        css={{
          fontSize: '1',
          maxH: '70vh',
          maxW: '21rem',
          minW: '17rem',
          overflowY: 'auto',
        }}
      >
        <DropdownMenuLabel>Chat history</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void navigate({ to: '/' })}>
          <HStack gap="2">
            <Icons.add size={14} />
            <span>New chat</span>
          </HStack>
        </DropdownMenuItem>
        {groups.map((group) => (
          <Box key={group.name}>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{group.name}</DropdownMenuLabel>
            {group.items.map((thread) => {
              const active = thread.id === activeThreadId;

              return (
                <DropdownMenuItem
                  key={thread.id}
                  onSelect={() =>
                    void navigate({
                      to: '/chat/$threadId',
                      params: { threadId: thread.id },
                    })
                  }
                >
                  <HStack gap="3" justify="space-between" minW="0" w="full">
                    <HStack flex="1" gap="2" minW="0">
                      <Box
                        bg={active ? 'brand.primary.11' : 'transparent'}
                        flexShrink="0"
                        h="6px"
                        rounded="full"
                        w="6px"
                      />
                      <styled.span
                        overflow="hidden"
                        textOverflow="ellipsis"
                        whiteSpace="nowrap"
                      >
                        {thread.title || 'Untitled conversation'}
                      </styled.span>
                    </HStack>
                    <styled.span
                      color="text.muted"
                      flexShrink="0"
                      fontSize="0.688"
                    >
                      {relativeTime(thread.updatedAt)}
                    </styled.span>
                  </HStack>
                </DropdownMenuItem>
              );
            })}
          </Box>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
