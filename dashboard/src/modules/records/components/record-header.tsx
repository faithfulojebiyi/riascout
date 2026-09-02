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

const rule = css({
  borderBottomWidth: '1px',
  borderColor: 'brand.panel.4',
});

/** every header row is one 44px band, so the rules land on a regular rhythm */
const ROW_HEIGHT = '2.75rem';

/**
 * Breadcrumb, a rule, the identity line, another rule, then the tab strip. The
 * subtitle sits beside the name rather than under it: SEC and the CRD identify
 * the same thing the name does, so a third stacked row spent vertical space to
 * say nothing extra.
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
    <div className={css({ flexShrink: '0' })}>
      <Flex align="center" className={rule} gap="2" h={ROW_HEIGHT} px="5">
        <Link
          className={crumb}
          params={{ entitySlug: record.entitySlug }}
          to="/$entitySlug"
        >
          {record.entityName}
        </Link>
        <span className={css({ color: 'text.placeholder', fontSize: '1' })}>
          /
        </span>
        <span className={css({ fontSize: '1' })}>{title}</span>
      </Flex>

      <Flex
        align="center"
        className={rule}
        gap="3"
        h={ROW_HEIGHT}
        justify="space-between"
        px="5"
      >
        <Flex align="baseline" gap="3" minW="0">
          <h1
            className={css({
              fontSize: '4',
              fontWeight: 'semibold',
              lineHeight: 'tight',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            })}
          >
            {title}
          </h1>
          {subtitle ? (
            <span
              className={css({
                color: 'text.muted',
                flexShrink: '0',
                fontSize: '1',
              })}
            >
              {subtitle}
            </span>
          ) : null}
        </Flex>
        <Flex align="center" flexShrink="0" gap="2">
          {actions}
        </Flex>
      </Flex>
    </div>
  );
};
