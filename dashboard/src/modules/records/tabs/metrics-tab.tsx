import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { css } from '@riascout-ui/styled-system/css';
import { token } from '@riascout-ui/styled-system/tokens';

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
import { AumChart } from '../components/aum-chart';
import { TrendChart } from '../components/trend-chart';

const caption = css({ color: 'text.muted', fontSize: '0', pb: '3' });
const heading = css({ fontSize: '2', fontWeight: 'semibold', pb: '2', pt: '5' });

const toggle = css({
  _hover: { color: 'text.app' },
  color: 'text.muted',
  cursor: 'pointer',
  fontSize: '1',
  pt: '4',
});

const count = (value: number | null) =>
  value === null ? '—' : value.toLocaleString();

export const MetricsTab = ({ firmCrd }: { firmCrd: string | null }) => {
  const [showTable, setShowTable] = useState(false);
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
        firm files 8 times and reports 3 distinct AUM values — so fewer points
        than filings is normal, not a gap in the record.
      */}
      <p className={caption}>
        {data.points.length} change
        {data.points.length === 1 ? '' : 's'} across{' '}
        {data.filingCount.toLocaleString()} filing
        {data.filingCount === 1 ? '' : 's'}, by submission date.
      </p>

      <h2 className={heading}>Assets under management</h2>
      <AumChart points={data.points} />

      <h2 className={heading}>Clients</h2>
      <TrendChart
        color={token('colors.brand.info.9')}
        dataKey="clientCount"
        label="Clients"
        points={data.points}
      />

      <h2 className={heading}>Employees</h2>
      <TrendChart
        color={token('colors.brand.warning.9')}
        dataKey="employeeCount"
        label="Employees"
        points={data.points}
      />

      <h2 className={heading}>Offices</h2>
      <TrendChart
        color={token('colors.brand.success.9')}
        dataKey="officeCount"
        label="Offices"
        points={data.points}
      />

      <button
        className={toggle}
        onClick={() => setShowTable(!showTable)}
        type="button"
      >
        {showTable ? 'Hide the figures' : 'Show the figures'}
      </button>

      {showTable ? (
        <Table fontSize="1" w="full">
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
      ) : null}
    </>
  );
};
