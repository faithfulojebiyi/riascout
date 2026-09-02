import type { ICellRendererParams } from 'ag-grid-enterprise';
import { Link } from '@tanstack/react-router';
import { css } from '@riascout-ui/styled-system/css';

import { rendererForColumn } from '../attribute-renderers';
import type { GridRow } from '../../types/grid';

export type CellRendererParams = ICellRendererParams<GridRow> & {
  attributeId: string;
  attributeType: string;
  /** the market allowlist key; a CRD renders unformatted despite its type */
  referenceColumn?: string | null;
  /** value/label pairs for a coded column */
  options?: { value: string; label: string }[];
  isMultiValue: boolean;
  /** projected market columns arrive on the row, not in the cell map */
  projectedKey?: string;
};

/**
 * The name column opens the record. Keyed by allowlist key because the view
 * field says nothing about which column is the primary one.
 */
const NAME_COLUMNS = new Set(['firm.firm_name', 'advisor.full_name']);

const link = css({
  _hover: { color: 'text.app' },
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
});

/** bridges ag-grid's cell API to the type-keyed renderer registry */
export const CellRendererAdapter = (params: CellRendererParams) => {
  const Renderer = rendererForColumn(
    params.referenceColumn,
    params.attributeType,
    params.isMultiValue,
  );
  const value = params.data?.cellsByAttributeId[params.attributeId];
  const recordId = params.data?.id;

  /**
   * Only this cell is interactive — no row-click handler. A whole-row target
   * would fight cell focus and selection, and nothing on screen would say the
   * row was clickable.
   */
  if (
    recordId &&
    params.referenceColumn &&
    NAME_COLUMNS.has(params.referenceColumn) &&
    typeof value === 'string' &&
    value.trim() !== ''
  ) {
    return (
      <Link className={link} params={{ recordId }} to="/record/$recordId">
        {value}
      </Link>
    );
  }

  return <Renderer options={params.options} value={value} />;
};
