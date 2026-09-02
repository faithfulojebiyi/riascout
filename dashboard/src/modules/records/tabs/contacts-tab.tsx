import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { css } from '@riascout-ui/styled-system/css';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/primitives/table';
import { firmContactsQuery } from '../record-queries';
import { NoMarketLink, NothingReported, TabLoading } from './tab-state';

const PAGE = 50;

const caption = css({ color: 'text.muted', fontSize: '0', pb: '3' });
const link = css({
  _hover: { color: 'text.app' },
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
});

export const ContactsTab = ({ firmCrd }: { firmCrd: string | null }) => {
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    ...firmContactsQuery(firmCrd ?? '', offset, PAGE),
    enabled: !!firmCrd,
  });

  if (!firmCrd) {
    return <NoMarketLink />;
  }

  if (query.isPending) {
    return <TabLoading />;
  }

  const data = query.data;

  if (!data || data.total === 0) {
    return <NothingReported what="linked advisers" />;
  }

  /**
   * The roster holds an adviser at their primary open registration only, so a
   * dual registrant counted in the affiliation total can be missing here. The
   * gap is stated rather than silently absorbed.
   */
  const unlisted =
    data.affiliationTotal !== null && data.affiliationTotal > data.total
      ? data.affiliationTotal - data.total
      : 0;

  return (
    <>
      <p className={caption}>
        {data.total.toLocaleString()} adviser
        {data.total === 1 ? '' : 's'} registered here
        {unlisted > 0
          ? `; ${unlisted.toLocaleString()} more are affiliated but registered primarily elsewhere`
          : ''}
        .
      </p>
      <Table fontSize="1" w="full">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Tenure</TableHead>
            <TableHead>Experience</TableHead>
            <TableHead>Disclosures</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.contacts.map((contact) => (
            <TableRow key={contact.advisorCrd}>
              <TableCell>
                {contact.recordId ? (
                  <Link
                    className={link}
                    params={{ recordId: contact.recordId }}
                    to="/record/$recordId"
                  >
                    {contact.fullName ?? `CRD #${contact.advisorCrd}`}
                  </Link>
                ) : (
                  (contact.fullName ?? `CRD #${contact.advisorCrd}`)
                )}
              </TableCell>
              <TableCell>
                {[contact.city, contact.state].filter(Boolean).join(', ') || '—'}
              </TableCell>
              {/* an observation-backed link has no start date, so null is real */}
              <TableCell>
                {contact.tenureYears === null ? '—' : `${contact.tenureYears}y`}
              </TableCell>
              <TableCell>
                {contact.experienceYears === null
                  ? '—'
                  : `${contact.experienceYears}y`}
              </TableCell>
              <TableCell>{contact.disclosureCount ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
          onClick={() => setOffset(Math.max(0, offset - PAGE))}
          type="button"
        >
          Previous
        </button>
        <span>
          {offset + 1}–{Math.min(offset + PAGE, data.total)} of{' '}
          {data.total.toLocaleString()}
        </span>
        <button
          className={css({ _disabled: { opacity: '0.4' }, cursor: 'pointer' })}
          disabled={offset + PAGE >= data.total}
          onClick={() => setOffset(offset + PAGE)}
          type="button"
        >
          Next
        </button>
      </div>
    </>
  );
};
