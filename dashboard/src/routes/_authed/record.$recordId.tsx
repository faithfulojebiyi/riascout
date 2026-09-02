import { css } from '@riascout-ui/styled-system/css';
import { createFileRoute } from '@tanstack/react-router';

import { entitiesControllerGetEntityRecord } from '../../api/generated/entities/entities';
import { RecordAttributesPanel } from '../../modules/records/components/record-attributes-panel';
import { RecordHeader } from '../../modules/records/components/record-header';
import { RecordTabs } from '../../modules/records/components/record-tabs';
import { Skeleton } from '../../ui/primitives/skeleton';

export const Route = createFileRoute('/_authed/record/$recordId')({
  pendingComponent: RecordPageSkeleton,
  loader: ({ params }) =>
    entitiesControllerGetEntityRecord({ recordId: params.recordId }),
  component: RecordPage,
});

const page = css({
  display: 'flex',
  flexDirection: 'column',
  h: '100dvh',
  minH: '0',
});

const body = css({ display: 'flex', flex: '1', minH: '0' });

const panel = css({
  borderLeftWidth: '1px',
  borderColor: 'brand.panel.4',
  flexShrink: '0',
  overflowY: 'auto',
  w: '20rem',
});

function RecordPage() {
  const record = Route.useLoaderData();

  /**
   * The market tabs key on the CRD, not the record id — market data is global,
   * so two saved records pointing at one firm share a cache entry. A hand-made
   * record has no CRD and the tabs say so rather than showing an empty firm.
   */
  const firmCrd =
    record.market.sourceKind === 'firm' ? record.market.sourceCrd : null;

  return (
    <div className={page}>
      <RecordHeader record={record} />
      <div className={body}>
        <div
          className={css({
            display: 'flex',
            flex: '1',
            flexDirection: 'column',
            minH: '0',
            minW: '0',
          })}
        >
          <RecordTabs firmCrd={firmCrd} record={record} />
        </div>
        <aside className={panel}>
          <RecordAttributesPanel record={record} />
        </aside>
      </div>
    </div>
  );
}

/** mirrors the real geometry, so nothing moves when the record lands */
function RecordPageSkeleton() {
  return (
    <div className={page}>
      <div
        className={css({
          borderBottomWidth: '1px',
          borderColor: 'brand.panel.4',
          flexShrink: '0',
          px: '5',
          py: '3',
        })}
      >
        <Skeleton h="0.75rem" w="12rem" />
        <div className={css({ pt: '3' })}>
          <Skeleton h="1.5rem" w="20rem" />
        </div>
        <div className={css({ pt: '2' })}>
          <Skeleton h="0.75rem" w="14rem" />
        </div>
      </div>
      <div className={body}>
        <div className={css({ display: 'grid', flex: '1', gap: '2', p: '5' })}>
          {Array.from({ length: 8 }, (_, row) => (
            <Skeleton h="1rem" key={`record-skeleton-${row}`} w={row % 2 ? '62%' : '84%'} />
          ))}
        </div>
        <aside className={panel}>
          <div className={css({ display: 'grid', gap: '2', p: '4' })}>
            {Array.from({ length: 10 }, (_, row) => (
              <Skeleton h="1rem" key={`panel-skeleton-${row}`} w="90%" />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
