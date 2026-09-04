import { Flex, styled } from '@riascout-ui/styled-system/jsx';

import { Icons } from '../../../../ui/icons/base';
import { ArtifactCard } from './artifact-card';
import { type ApprovalDescription, isRecord } from './types';

type Change = { field: string; label: string; from: unknown; to: unknown };

type UpdateResult = {
  record: {
    id: string;
    sourceCrd: string;
    url: string;
    created: boolean;
  } | null;
  changes: Change[];
  fieldErrors?: { field: string; message: string }[];
};

const isUpdateResult = (value: unknown): value is UpdateResult =>
  isRecord(value) && Array.isArray(value.changes);

const show = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return 'empty';
  if (Array.isArray(value)) return value.join(', ');

  return String(value);
};

const kindNoun = (input: unknown): string =>
  isRecord(input) && input.sourceKind === 'firm' ? 'firm' : 'adviser';

export const updateRecordDetail = (result: unknown): string | null =>
  isUpdateResult(result)
    ? result.fieldErrors?.length
      ? 'nothing written'
      : `${result.changes.length} field${result.changes.length === 1 ? '' : 's'}`
    : null;

/** the landed edit: a card to the record with each change on its own line */
export const RecordCard = ({
  result,
  input,
}: {
  result: unknown;
  input: unknown;
  toolCallId: string;
}) => {
  if (!isUpdateResult(result) || !result.record || result.fieldErrors?.length) {
    return null;
  }

  const { record, changes } = result;

  return (
    <ArtifactCard
      href={record.url}
      icon={<Icons.user size={16} />}
      meta={`${changes.length} field${changes.length === 1 ? '' : 's'} updated`}
      tag={record.created ? 'New record' : null}
      title={`${kindNoun(input)} CRD ${record.sourceCrd}`}
    >
      <Flex direction="column" fontSize="0.688" gap="1" px="3" py="2">
        {changes.map((change) => (
          <styled.div key={change.field}>
            <styled.span color="text.muted">{change.label}: </styled.span>
            <styled.span textDecoration="line-through" color="text.muted">
              {show(change.from)}
            </styled.span>
            <styled.span> {show(change.to)}</styled.span>
          </styled.div>
        ))}
      </Flex>
    </ArtifactCard>
  );
};

export const describeUpdateRecord = (input: unknown): ApprovalDescription => {
  if (!isRecord(input)) return { title: 'Update record', lines: [] };

  const values = Array.isArray(input.values)
    ? input.values.filter(isRecord)
    : [];

  return {
    title: 'Update record',
    lines: [
      `On ${kindNoun(input)} CRD ${String(input.sourceCrd ?? '?')}:`,
      ...values.map((v) => `Set ${String(v.field)} to ${show(v.value)}.`),
      'The adviser is saved as a record first if it is not one yet.',
    ],
  };
};
