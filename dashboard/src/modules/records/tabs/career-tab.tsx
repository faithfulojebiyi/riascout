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
import { advisorProfileQuery } from '../record-queries';
import { NoMarketLink, NothingReported, TabLoading } from './tab-state';
import { CareerTimeline } from '../components/career-timeline';

const heading = css({ fontSize: '2', fontWeight: 'semibold', pb: '2', pt: '5' });
const caption = css({ color: 'text.muted', fontSize: '0', pb: '3' });

const month = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        month: 'short',
        year: 'numeric',
      })
    : '—';

export const CareerTab = ({ advisorCrd }: { advisorCrd: string | null }) => {
  const query = useQuery({
    ...advisorProfileQuery(advisorCrd ?? ''),
    enabled: !!advisorCrd,
  });

  if (!advisorCrd) {
    return <NoMarketLink />;
  }

  if (query.isPending) {
    return <TabLoading />;
  }

  const data = query.data;

  if (!data || data.stints.length === 0) {
    return <NothingReported what="registrations" />;
  }

  return (
    <>
      <h2 className={heading}>Registered affiliations</h2>
      {/*
        A firm appears twice when an adviser left and came back — those are two
        stints, not one tenure, and 25,056 advisers have exactly that shape.
      */}
      <p className={caption}>
        {data.stints.length} stint{data.stints.length === 1 ? '' : 's'} from
        state registrations.
      </p>
      <CareerTimeline stints={data.stints} />

      <h2 className={heading}>Reported employment</h2>
      {data.employment.length === 0 ? (
        <NothingReported what="employment history" />
      ) : (
        <>
          {/*
            Self-reported on the U4 and covers non-industry work, and the source
            carries no firm CRD at all — so it is never merged with the
            registrations above.
          */}
          <p className={caption}>
            As reported by the adviser; month precision, and not linked to a firm
            record.
          </p>
          <Table fontSize="1" w="full">
            <TableHeader>
              <TableRow>
                <TableHead>Employer</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.employment.map((row, index) => (
                <TableRow key={`${row.employerName}-${index}`}>
                  <TableCell>{row.employerName ?? '—'}</TableCell>
                  <TableCell>
                    {[row.city, row.region].filter(Boolean).join(', ') || '—'}
                  </TableCell>
                  <TableCell>{month(row.startMonth)}</TableCell>
                  <TableCell>
                    {row.isOpenEnded ? 'Present' : month(row.endMonth)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </>
  );
};
