import { css } from '@riascout-ui/styled-system/css';
import { Flex } from '@riascout-ui/styled-system/jsx';

import type { GetEntityRecordResponse } from '../../../api/generated/rIAScoutAPI.schemas';
import {
  TagList,
  rendererForColumn,
} from '../../entities/components/attribute-renderers';
import { attributeIcon } from '../../entities/components/grid/attribute-icon';
import { valuesByAttribute, type RecordValue } from '../record-values';

const UNGROUPED = 'Details';

/** minW 0 is what lets the ellipsis engage; without it the label ran under the value */
const label = css({
  color: 'text.muted',
  flex: '1',
  fontSize: '1',
  minW: '0',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
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
  const Icon = attributeIcon(attribute.icon, attribute.type);

  /**
   * The panel wraps its multi-value chips rather than clipping them: it has no
   * row height to preserve, and a clipped list hid most of a firm's client
   * types behind the panel edge.
   */
  const Renderer = attribute.isMultiValue
    ? TagList
    : rendererForColumn(attribute.referenceColumn, attribute.type, false);

  return (
    <Flex align="flex-start" gap="2" py="1">
      <Flex align="center" flexShrink="0" gap="1.5" pt="0.5" w="10.5rem">
        <Icon className={css({ color: 'text.placeholder', flexShrink: '0' })} />
        <span className={label} title={attribute.label}>
          {attribute.label}
        </span>
      </Flex>
      <div className={css({ flex: '1', fontSize: '1', minW: '0' })}>
        <Renderer options={attribute.options} value={value} />
      </div>
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
    const key = entry.attribute.group?.trim() || UNGROUPED;

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
