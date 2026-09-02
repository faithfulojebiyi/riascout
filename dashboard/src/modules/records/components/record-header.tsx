import { Link } from '@tanstack/react-router';
import { css } from '@riascout-ui/styled-system/css';
import { Flex } from '@riascout-ui/styled-system/jsx';

import type { GetEntityRecordResponse } from '../../../api/generated/rIAScoutAPI.schemas';
import { recordTitle, recordSubtitle } from '../record-values';

const crumb = css({
  _hover: { color: 'text.app' },
  color: 'text.muted',
  fontSize: '1',
});

/**
 * Three stacked rows: breadcrumb, then the identity line with its actions, then
 * the subtitle beneath the name rather than beside it. The header spans the full
 * width so the tab strip and the attributes panel start at the same y.
 */
export const RecordHeader = ({
  record,
  actions,
}: {
  record: GetEntityRecordResponse;
  actions?: React.ReactNode;
}) => {
  const title = recordTitle(record);
  const subtitle = recordSubtitle(record);

  return (
    <div
      className={css({
        borderBottomWidth: '1px',
        borderColor: 'brand.panel.4',
        flexShrink: '0',
        px: '5',
        pt: '3',
      })}
    >
      <Flex align="center" gap="2" h="6">
        <Link className={crumb} params={{ entitySlug: record.entitySlug }} to="/$entitySlug">
          {record.entityName}
        </Link>
        <span className={css({ color: 'text.placeholder', fontSize: '1' })}>
          /
        </span>
        <span className={css({ fontSize: '1' })}>{title}</span>
      </Flex>

      <Flex align="flex-start" gap="3" justify="space-between" pb="3" pt="1">
        <div>
          <h1
            className={css({
              fontSize: '4',
              fontWeight: 'semibold',
              lineHeight: 'tight',
            })}
          >
            {title}
          </h1>
          {subtitle ? (
            <p className={css({ color: 'text.muted', fontSize: '1', pt: '0.5' })}>
              {subtitle}
            </p>
          ) : null}
        </div>
        <Flex align="center" gap="2" flexShrink="0">
          {actions}
        </Flex>
      </Flex>
    </div>
  );
};
