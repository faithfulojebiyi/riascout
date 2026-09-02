import { useQuery } from '@tanstack/react-query';
import { css } from '@riascout-ui/styled-system/css';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/primitives/table';
import { firmFilingsQuery } from '../record-queries';
import { NeverFiled, NoMarketLink, TabLoading } from './tab-state';

const heading = css({ fontSize: '2', fontWeight: 'semibold', pb: '2', pt: '5' });
const badge = css({
  bg: 'background.muted',
  borderRadius: 'md',
  fontSize: '0',
  ml: '2',
  px: '1.5',
  py: '0.5',
});

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString() : '—';

export const FilingsTab = ({ firmCrd }: { firmCrd: string | null }) => {
  const query = useQuery({ ...firmFilingsQuery(firmCrd ?? ''), enabled: !!firmCrd });

  if (!firmCrd) {
    return <NoMarketLink />;
  }

  if (query.isPending) {
    return <TabLoading />;
  }

  const data = query.data;

  if (!data || data.filings.length === 0) {
    return <NeverFiled />;
  }

  return (
    <>
      <h2 className={heading}>Filings</h2>
      <Table fontSize="1">
        <TableHeader>
          <TableRow>
            <TableHead>Submitted</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>SEC number</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.filings.map((filing) => (
            <TableRow key={filing.filingId}>
              <TableCell>
                {day(filing.submittedAt)}
                {filing.isCurrent ? <span className={badge}>current</span> : null}
              </TableCell>
              <TableCell>{filing.filingType ?? '—'}</TableCell>
              <TableCell>{filing.registrationCategory ?? '—'}</TableCell>
              <TableCell>{filing.secNumber ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {data.events.length > 0 ? (
        <>
          <h2 className={heading}>Registration history</h2>
          <Table fontSize="1">
            <TableHeader>
              <TableRow>
                <TableHead>Effective</TableHead>
                <TableHead>Authority</TableHead>
                <TableHead>Jurisdiction</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.events.map((event) => (
                <TableRow key={event.eventId}>
                  <TableCell>{day(event.effectiveDate)}</TableCell>
                  <TableCell>{event.authority ?? '—'}</TableCell>
                  <TableCell>{event.jurisdiction ?? '—'}</TableCell>
                  <TableCell>{event.status ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      ) : null}
    </>
  );
};
