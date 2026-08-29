import type { ICellRendererParams } from 'ag-grid-enterprise';

import { rendererFor } from '../attribute-renderers';
import type { GridRow } from '../../types/grid';

export type CellRendererParams = ICellRendererParams<GridRow> & {
  attributeId: string;
  attributeType: string;
  isMultiValue: boolean;
  /** projected market columns arrive on the row, not in the cell map */
  projectedKey?: string;
};

/** bridges ag-grid's cell API to the type-keyed renderer registry */
export const CellRendererAdapter = (params: CellRendererParams) => {
  const Renderer = rendererFor(params.attributeType, params.isMultiValue);
  const value = params.data?.cellsByAttributeId[params.attributeId];

  return <Renderer value={value} />;
};
