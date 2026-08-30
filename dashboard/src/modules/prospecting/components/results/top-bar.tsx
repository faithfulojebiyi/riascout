import { Flex } from '@riascout-ui/styled-system/jsx';

import { Tabs, TabsList, TabTrigger } from '../../../../ui/primitives/tabs';
import { Span } from '../../../../ui/primitives/text';

export type ProspectTab = 'search' | 'saved';

export type TopBarProps = {
  tab: ProspectTab;
  onTabChange: (tab: ProspectTab) => void;
  total: number | null;
  isFetching: boolean;
};

export const TopBar = ({
  tab,
  onTabChange,
  total,
  isFetching,
}: TopBarProps) => (
  <Flex
    align="center"
    borderBottomWidth="1px"
    borderColor="border.subtle"
    gap="3"
    px="4"
    py="2"
  >
    <Tabs onValueChange={(v) => onTabChange(v as ProspectTab)} value={tab}>
      <TabsList>
        <TabTrigger value="search">Search results</TabTrigger>
        {/* saved needs the lists module; visible so the shape is honest */}
        <TabTrigger disabled value="saved">
          Saved
        </TabTrigger>
      </TabsList>
    </Tabs>

    <Span fontSize="sm" fontWeight="medium">
      {total === null ? '—' : `${total.toLocaleString()} advisors`}
    </Span>
    {isFetching ? (
      <Span color="text.placeholder" fontSize="sm">
        Updating…
      </Span>
    ) : null}
  </Flex>
);
