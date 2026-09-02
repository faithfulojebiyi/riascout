import { css } from '@riascout-ui/styled-system/css';

import { Tabs, TabsList, TabTrigger, TabContent } from '../../../ui/primitives/tabs';
import type { GetEntityRecordResponse } from '../../../api/generated/rIAScoutAPI.schemas';
import { OverviewTab } from '../tabs/overview-tab';
import { ContactsTab } from '../tabs/contacts-tab';
import { MetricsTab } from '../tabs/metrics-tab';
import { OfficesTab } from '../tabs/offices-tab';
import { CustodiansTab } from '../tabs/custodians-tab';

/**
 * 13-F holdings, SMAs, transactions and news have no ingestion pipeline, so they
 * are shown disabled rather than hidden: an absent tab reads as a product that
 * does not cover them, an empty one as a firm that has none.
 */
const COMING_SOON = ['Current Holdings', 'SMAs', 'Transactions', 'News'];

export const RecordTabs = ({
  record,
  firmCrd,
}: {
  record: GetEntityRecordResponse;
  firmCrd: string | null;
}) => (
  <Tabs
    className={css({ display: 'flex', flexDirection: 'column', minH: '0' })}
    defaultValue="overview"
  >
    {/* the rule runs the full width; only the labels are inset */}
    <div>
      <TabsList px="5" variant="underline">
        <TabTrigger value="overview" variant="underline">
          Overview
        </TabTrigger>
        <TabTrigger value="contacts" variant="underline">
          Contacts
        </TabTrigger>
        <TabTrigger value="metrics" variant="underline">
          AUM &amp; Accounts
        </TabTrigger>
        <TabTrigger value="offices" variant="underline">
          Office Locations
        </TabTrigger>
        <TabTrigger value="custodians" variant="underline">
          Custodians &amp; Funds
        </TabTrigger>
        {COMING_SOON.map((name) => (
          <TabTrigger disabled key={name} value={name} variant="underline">
            {name}
          </TabTrigger>
        ))}
      </TabsList>
    </div>

    <div className={css({ flex: '1', minH: '0', overflowY: 'auto', px: '5', py: '4' })}>
      <TabContent value="overview">
        <OverviewTab firmCrd={firmCrd} record={record} />
      </TabContent>
      <TabContent value="contacts">
        <ContactsTab firmCrd={firmCrd} />
      </TabContent>
      <TabContent value="metrics">
        <MetricsTab firmCrd={firmCrd} />
      </TabContent>
      <TabContent value="offices">
        <OfficesTab firmCrd={firmCrd} />
      </TabContent>
      <TabContent value="custodians">
        <CustodiansTab firmCrd={firmCrd} />
      </TabContent>
    </div>
  </Tabs>
);
