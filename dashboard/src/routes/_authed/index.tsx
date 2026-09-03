import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';

import { Box, Flex, HStack, styled } from '@riascout-ui/styled-system/jsx';

import { Composer } from '../../modules/assistant/components/composer';
import { SUGGESTED_PROMPTS } from '../../modules/assistant/constants';
import { setPendingMessage } from '../../modules/assistant/pending-message';
import { useThreads } from '../../modules/assistant/queries/use-threads';
import { relativeTime } from '../../modules/assistant/relative-time';
import { Button } from '../../ui/primitives/button';

export const Route = createFileRoute('/_authed/')({
  component: Home,
});

const greetingFor = (hour: number): string =>
  hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

/**
 * The home page is the assistant. The first message is written here and
 * finished on the thread page, so the url is the thread from the first reply.
 */
function Home() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const { data: threads } = useThreads();
  const firstName = user.name?.split(' ')[0] || null;

  const start = (message: string) => {
    const threadId = crypto.randomUUID();

    setPendingMessage(threadId, message);
    void navigate({ to: '/chat/$threadId', params: { threadId } });
  };

  const recent = (threads ?? []).slice(0, 6);

  return (
    <Flex
      direction="column"
      h="full"
      overflowY="auto"
      px="6"
      pt={{ base: '12', md: '18vh' }}
      pb="12"
    >
      <Flex direction="column" gap="8" maxW="44rem" mx="auto" w="full">
        <Box>
          <styled.h1
            fontSize={{ base: '7', md: '8' }}
            fontWeight="500"
            letterSpacing="-0.02em"
            lineHeight="1.15"
          >
            {greetingFor(new Date().getHours())}
            {firstName ? (
              <>
                , <styled.span color="text.muted">{firstName}</styled.span>
              </>
            ) : null}
            .
          </styled.h1>
          <styled.p color="text.muted" fontSize="3" lineHeight="1.5" mt="3">
            Every SEC-registered firm and the advisers who work there. Ask for a
            shortlist, a firm, or who moved.
          </styled.p>
        </Box>

        <Composer autoFocus onSend={start} showHint />

        <HStack flexWrap="wrap" gap="2">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <Button
              borderColor="brand.panel.10"
              borderWidth="1px"
              fontWeight="400"
              key={prompt}
              onClick={() => start(prompt)}
              rounded="full"
              size="sm"
              variant="ghost"
            >
              {prompt}
            </Button>
          ))}
        </HStack>

        {recent.length > 0 ? (
          <Box>
            <styled.div color="text.muted" fontSize="1" mb="2">
              Recent
            </styled.div>
            <Flex direction="column">
              {recent.map((thread) => (
                <Link
                  key={thread.id}
                  params={{ threadId: thread.id }}
                  to="/chat/$threadId"
                >
                  <Flex
                    alignItems="baseline"
                    borderColor="brand.panel.8"
                    borderTopWidth="1px"
                    gap="4"
                    justifyContent="space-between"
                    px="1"
                    py="2.5"
                    _hover={{ bg: 'brand.panel.2' }}
                  >
                    <styled.span
                      fontSize="2"
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                    >
                      {thread.title || 'Untitled conversation'}
                    </styled.span>
                    <styled.span color="text.muted" flexShrink="0" fontSize="1">
                      {relativeTime(thread.updatedAt)}
                    </styled.span>
                  </Flex>
                </Link>
              ))}
            </Flex>
          </Box>
        ) : null}
      </Flex>
    </Flex>
  );
}
