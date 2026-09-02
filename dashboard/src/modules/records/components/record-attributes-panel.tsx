import { css } from '@riascout-ui/styled-system/css';
import { Flex } from '@riascout-ui/styled-system/jsx';

import type { GetEntityRecordResponse } from '../../../api/generated/rIAScoutAPI.schemas';
import { rendererForColumn } from '../../entities/components/attribute-renderers';
import { valuesByAttribute, type RecordValue } from '../record-values';

const UNGROUPED = 'Details';

const label = css({
  color: 'text.muted',
  flexShrink: '0',
  fontSize: '1',
  w: '9.5rem',
});

const heading = css({
  color: 'text.muted',
  fontSize: '0',
  fontWeight: 'semibold',
  letterSpacing: 'wide',
  pb: '1.5',
  pt: '4',
  textTransform: 'uppercase',
});

const Row = ({ attribute, value }: RecordValue) => {
  const Renderer = rendererForColumn(
    attribute.referenceColumn,
    attribute.type,
    attribute.isMultiValue,
  );

  return (
    <Flex align="baseline" gap="2" py="1">
      <span className={label} title={attribute.label}>
        {attribute.label}
      </span>
      <span className={css({ fontSize: '1', minW: '0' })}>
        <Renderer options={attribute.options} value={value} />
      </span>
    </Flex>
  );
};

/**
 * Every attribute on the entity, grouped by EntityAttribute.group — the field
 * that exists for this panel. Deliberately not filtered by the grid's view: a
 * column hidden there is still a fact about the record.
 */
export const RecordAttributesPanel = ({
  record,
}: {
  record: GetEntityRecordResponse;
}) => {
  const groups = new Map<string, RecordValue[]>();

  for (const entry of valuesByAttribute(record)) {
    const key = entry.attribute.group ?? UNGROUPED;

    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  return (
    <div className={css({ px: '4', pb: '6' })}>
      {[...groups].map(([group, rows]) => (
        <section key={group}>
          <h2 className={heading}>{group}</h2>
          {rows.map((row) => (
            <Row key={row.attribute.attributeId} {...row} />
          ))}
        </section>
      ))}

      {record.lists.length > 0 ? (
        <section>
          <h2 className={heading}>Lists</h2>
          {record.lists.map((list) => (
            <div className={css({ fontSize: '1', py: '1' })} key={list.listId}>
              {list.name}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
};
