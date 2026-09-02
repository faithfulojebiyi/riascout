import { useQuery } from '@tanstack/react-query';
import { css } from '@riascout-ui/styled-system/css';

import { advisorProfileQuery } from '../record-queries';
import { NoMarketLink, NothingReported, TabLoading } from './tab-state';

const heading = css({ fontSize: '2', fontWeight: 'semibold', pb: '2', pt: '5' });
const chip = css({
  bg: 'background.muted',
  borderRadius: 'md',
  display: 'inline-block',
  fontSize: '1',
  mb: '1',
  mr: '1.5',
  px: '2',
  py: '0.5',
});
const note = css({ color: 'text.muted', fontSize: '1', py: '2' });

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString() : null;

export const CredentialsTab = ({ advisorCrd }: { advisorCrd: string | null }) => {
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

  if (!data) {
    return <NothingReported what="credentials" />;
  }

  return (
    <>
      <h2 className={heading}>Exams</h2>
      {data.exams.length === 0 ? (
        <NothingReported what="exams" />
      ) : (
        <div>
          {data.exams.map((exam) => {
            const taken = day(exam.takenOn);

            return (
              <span className={chip} key={`${exam.code}-${exam.takenOn}`}>
                {exam.code}
                {taken ? ` · ${taken}` : ''}
              </span>
            );
          })}
        </div>
      )}

      <h2 className={heading}>Designations</h2>
      {data.designations.length === 0 ? (
        <NothingReported what="designations" />
      ) : (
        <div>
          {data.designations.map((designation) => (
            <span className={chip} key={designation}>
              {designation}
            </span>
          ))}
        </div>
      )}

      <h2 className={heading}>Jurisdictions</h2>
      {data.jurisdictions.length === 0 ? (
        // null on ~592,828 registration rows, mostly closed ones
        <p className={note}>No jurisdiction was recorded on these registrations.</p>
      ) : (
        <div>
          {data.jurisdictions.map((jurisdiction) => (
            <span className={chip} key={jurisdiction}>
              {jurisdiction}
            </span>
          ))}
        </div>
      )}

      <h2 className={heading}>Disclosures</h2>
      {/*
        Three states, kept apart. A null flag means the record was never
        populated — "we have not looked" — which must not read as a clean
        record, and neither must a genuine none-reported.
      */}
      {data.disclosures.anyReported === null ? (
        <p className={note}>Disclosure flags are not available for this adviser.</p>
      ) : data.disclosures.reported.length === 0 ? (
        <p className={note}>No disclosures reported.</p>
      ) : (
        <div>
          {data.disclosures.reported.map((item) => (
            <span className={chip} key={item}>
              {item}
            </span>
          ))}
        </div>
      )}
    </>
  );
};
