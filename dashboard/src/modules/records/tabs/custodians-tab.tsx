import { useState } from 'react';
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
import { firmCustodiansQuery, firmFundsQuery } from '../record-queries';
import { NeverFiled, NoMarketLink, NothingReported, TabLoading } from './tab-state';
import { Money } from '../components/money';

const FUND_PAGE = 50;

const caption = css({ color: 'text.muted', fontSize: '0', pb: '2' });
const heading = css({ fontSize: '2', fontWeight: 'semibold', pb: '2', pt: '5' });

export const CustodiansTab = ({ firmCrd }: { firmCrd: string | null }) => {
  const [offset, setOffset] = useState(0);
  const custodians = useQuery({
    ...firmCustodiansQuery(firmCrd ?? ''),
    enabled: !!firmCrd,
  });
  const funds = useQuery({
    ...firmFundsQuery(firmCrd ?? '', offset, FUND_PAGE),
    enabled: !!firmCrd,
  });

  if (!firmCrd) {
    return <NoMarketLink />;
  }

  if (custodians.isPending) {
    return <TabLoading />;
  }

  if (!custodians.data?.filingId) {
    return <NeverFiled />;
  }

  const total = funds.data?.total ?? 0;

  return (
    <>
      <h2 className={heading}>Custodians</h2>
      {custodians.data.custodians.length === 0 ? (
        <NothingReported what="custodians" />
      ) : (
        <>
          {/*
            The filing lists a custodian once per fund, so the fund count is how
            many times it was named — not how many custodians there are.
          */}
          <p className={caption}>
            Rolled up by custodian; a filing names one once per fund.
          </p>
          <Table fontSize="1">
            <TableHeader>
              <TableRow>
                <TableHead>Custodian</TableHead>
                <TableHead>Funds</TableHead>
                <TableHead>Assets held</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {custodians.data.custodians.map((c, index) => (
                <TableRow key={c.custodianName ?? `custodian-${index}`}>
                  <TableCell>
                    {c.custodianName ?? '—'}
                    {c.isResolved ? null : (
                      <span className={css({ color: 'text.placeholder', pl: '2' })}>
                        as filed
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{c.fundCount}</TableCell>
                  <TableCell>
                    <Money value={c.aumAtCustodian} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      <h2 className={heading}>Private funds</h2>
      {funds.isPending ? (
        <TabLoading rows={4} />
      ) : total === 0 ? (
        <NothingReported what="private funds" />
      ) : (
        <>
          <Table fontSize="1">
            <TableHeader>
              <TableRow>
                <TableHead>Fund</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Gross asset value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {funds.data?.funds.map((f, index) => (
                <TableRow key={f.privateFundId ?? `fund-${index}`}>
                  <TableCell>{f.fundName ?? '—'}</TableCell>
                  <TableCell>{f.fundTypeCode ?? '—'}</TableCell>
                  <TableCell>
                    <Money value={f.grossAssetValue} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pager
            offset={offset}
            onChange={setOffset}
            pageSize={FUND_PAGE}
            total={total}
          />
        </>
      )}
    </>
  );
};

const Pager = ({
  offset,
  total,
  pageSize,
  onChange,
}: {
  offset: number;
  total: number;
  pageSize: number;
  onChange: (next: number) => void;
}) => (
  <div
    className={css({
      alignItems: 'center',
      color: 'text.muted',
      display: 'flex',
      fontSize: '1',
      gap: '3',
      pt: '3',
    })}
  >
    <button
      className={css({ _disabled: { opacity: '0.4' }, cursor: 'pointer' })}
      disabled={offset === 0}
      onClick={() => onChange(Math.max(0, offset - pageSize))}
      type="button"
    >
      Previous
    </button>
    <span>
      {offset + 1}–{Math.min(offset + pageSize, total)} of {total.toLocaleString()}
    </span>
    <button
      className={css({ _disabled: { opacity: '0.4' }, cursor: 'pointer' })}
      disabled={offset + pageSize >= total}
      onClick={() => onChange(offset + pageSize)}
      type="button"
    >
      Next
    </button>
  </div>
);
