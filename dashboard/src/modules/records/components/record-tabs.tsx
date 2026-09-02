import type { ReactNode } from 'react';
import { css } from '@riascout-ui/styled-system/css';

import { Tabs, TabsList, TabTrigger, TabContent } from '../../../ui/primitives/tabs';
import type { GetEntityRecordResponse } from '../../../api/generated/rIAScoutAPI.schemas';
import { OverviewTab } from '../tabs/overview-tab';
import { ContactsTab } from '../tabs/contacts-tab';
import { MetricsTab } from '../tabs/metrics-tab';
import { OfficesTab } from '../tabs/offices-tab';
import { CustodiansTab } from '../tabs/custodians-tab';
import { AdvisorOverviewTab } from '../tabs/advisor-overview-tab';
import { CareerTab } from '../tabs/career-tab';
import { CredentialsTab } from '../tabs/credentials-tab';

/**
 * 13-F holdings, SMAs, transactions and news have no ingestion pipeline, so they
 * are shown disabled rather than hidden: an absent tab reads as a product that
 * does not cover them, an empty one as a firm that has none.
 */
const FIRM_COMING_SOON = ['Current Holdings', 'SMAs', 'Transactions', 'News'];

/** same reasoning for advisers: neither has a source yet */
const ADVISOR_COMING_SOON = ['Contact Details', 'News'];

const Shell = ({
  triggers,
  panels,
}: {
  triggers: ReactNode;
  panels: ReactNode;
}) => (
  <Tabs
    className={css({ display: 'flex', flexDirection: 'column', minH: '0' })}
    defaultValue="overview"
  >
    {/* the rule runs the full width; only the labels are inset */}
    <div>
      <TabsList px="5" variant="underline">
        {triggers}
      </TabsList>
    </div>

    <div className={css({ flex: '1', minH: '0', overflowY: 'auto', px: '5', py: '4' })}>
      {panels}
    </div>
  </Tabs>
);

const ComingSoon = ({ names }: { names: string[] }) => (
  <>
    {names.map((name) => (
      <TabTrigger disabled key={name} value={name} variant="underline">
        {name}
      </TabTrigger>
    ))}
  </>
);

export const RecordTabs = ({
  record,
  firmCrd,
  advisorCrd,
}: {
  record: GetEntityRecordResponse;
  firmCrd: string | null;
  advisorCrd: string | null;
}) => {
  /**
   * Two strips rather than one with half of it disabled. A firm has no career
   * history and an adviser has no custodians, so the tabs answer different
   * questions rather than being the same set in two states.
   */
  if (record.market.sourceKind === 'advisor') {
    return (
      <Shell
        panels={
          <>
            <TabContent value="overview">
              <AdvisorOverviewTab record={record} />
            </TabContent>
            <TabContent value="career">
              <CareerTab advisorCrd={advisorCrd} />
            </TabContent>
            <TabContent value="credentials">
              <CredentialsTab advisorCrd={advisorCrd} />
            </TabContent>
          </>
        }
        triggers={
          <>
            <TabTrigger value="overview" variant="underline">
              Overview
            </TabTrigger>
            <TabTrigger value="career" variant="underline">
              Career
            </TabTrigger>
            <TabTrigger value="credentials" variant="underline">
              Licences &amp; Disclosures
            </TabTrigger>
            <ComingSoon names={ADVISOR_COMING_SOON} />
          </>
        }
      />
    );
  }

  return (
    <Shell
      panels={
        <>
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
        </>
      }
      triggers={
        <>
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
          <ComingSoon names={FIRM_COMING_SOON} />
        </>
      }
    />
  );
};
