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
import { firmMetricsQuery } from '../record-queries';
import { NeverFiled, NoMarketLink, TabLoading } from './tab-state';
import { Money } from '../components/money';

const caption = css({ color: 'text.muted', fontSize: '0', pb: '3' });

const count = (value: number | null) =>
  value === null ? '—' : value.toLocaleString();

export const MetricsTab = ({ firmCrd }: { firmCrd: string | null }) => {
  const query = useQuery({ ...firmMetricsQuery(firmCrd ?? ''), enabled: !!firmCrd });

  if (!firmCrd) {
    return <NoMarketLink />;
  }

  if (query.isPending) {
    return <TabLoading />;
  }

  const data = query.data;

  if (!data || data.filingCount === 0) {
    return <NeverFiled />;
  }

  return (
    <>
      {/*
        Says points-vs-filings outright. Firms restate constantly — the median
        firm files 8 times and reports 3 distinct AUM values — so a shorter list
        than the filing count is normal, not a gap in the record.
      */}
      <p className={caption}>
        {data.points.length} change
        {data.points.length === 1 ? '' : 's'} across{' '}
        {data.filingCount.toLocaleString()} filing
        {data.filingCount === 1 ? '' : 's'}, by submission date.
      </p>
      <Table fontSize="1">
        <TableHeader>
          <TableRow>
            <TableHead>Submitted</TableHead>
            <TableHead>Regulatory AUM</TableHead>
            <TableHead>Discretionary</TableHead>
            <TableHead>Non-discretionary</TableHead>
            <TableHead>Clients</TableHead>
            <TableHead>Employees</TableHead>
            <TableHead>Offices</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.points.map((point) => (
            <TableRow key={point.filingId}>
              <TableCell>
                {point.submittedAt
                  ? new Date(point.submittedAt).toLocaleDateString()
                  : '—'}
              </TableCell>
              <TableCell>
                <Money value={point.regulatoryAum} />
              </TableCell>
              <TableCell>
                <Money value={point.discretionaryAum} />
              </TableCell>
              <TableCell>
                <Money value={point.nonDiscretionaryAum} />
              </TableCell>
              <TableCell>{count(point.clientCount)}</TableCell>
              <TableCell>{count(point.employeeCount)}</TableCell>
              <TableCell>{count(point.officeCount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
};
