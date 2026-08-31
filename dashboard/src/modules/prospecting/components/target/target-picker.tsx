import { useNavigate } from '@tanstack/react-router';
import { Box, Grid } from '@riascout-ui/styled-system/jsx';

import { Icons } from '../../../../ui/icons/base';
import { Heading, Text } from '../../../../ui/primitives/text';
import { TargetCard } from './target-card';

export const TargetPicker = () => {
  const navigate = useNavigate();

  return (
    <Box maxW="72rem" mx="auto" px="6" py="10" w="full">
      <Box textAlign="center">
        <Heading as="h1" fontSize="5" fontWeight="600" letterSpacing="tight">
          Find prospects
        </Heading>
        <Text color="text.muted" fontSize="2" mt="1">
          Every SEC-registered firm and the advisors who work at them. Pick what
          you are looking for; the filters follow from it.
        </Text>
      </Box>

      <Text fontSize="2" fontWeight="500" mt="8">
        Select a source
      </Text>

      <Grid gap="4" gridTemplateColumns="repeat(3, 1fr)" mt="2">
        <TargetCard
          available
          color="indigo"
          description="By state, credential, tenure or current firm"
          icon={Icons.userSearch}
          onSelect={() => void navigate({ to: '/prospecting/advisors' })}
          title="Find advisors"
        />
        <TargetCard
          available
          color="teal"
          description="By AUM band, headcount, state or ownership"
          icon={Icons.building}
          onSelect={() => void navigate({ to: '/prospecting/firms' })}
          title="Find firms"
        />
        <TargetCard
          available={false}
          color="gray"
          description="And the firms that clear through them"
          icon={Icons.bank}
          onSelect={() => undefined}
          title="Find custodians"
        />
      </Grid>
    </Box>
  );
};
