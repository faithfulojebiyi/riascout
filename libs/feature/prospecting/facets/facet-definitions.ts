import type { AttributeType } from '@orm/app';

import { resolveReferenceColumn } from '@feature/entities/attribute-types/reference-columns.js';
import type { FilterOperator } from '@feature/entities/filter-sort/ast.js';
import { COLUMN_META } from '@feature/entities/data/column-meta.js';

import { facetKindFor, operatorsFor, type FacetKind } from './facet-kinds.js';

export type FacetOption = { value: string; label: string };

export type FacetDefinition = {
  attributeId: string;
  allowKey: string;
  label: string;
  icon: string | null;
  group: string;
  kind: FacetKind;
  /** kind drives the filter control; type drives the cell renderer */
  type: AttributeType;
  operators: FilterOperator[];
  isArray: boolean;
  /** populated for multiSelect; search facets fetch on demand */
  options: FacetOption[];
};

export type FacetAttribute = {
  id: string;
  label: string;
  icon: string | null;
  referenceColumn: string | null;
};

/**
 * Facets are derived from the allowlist, never hand-written. 102 columns cannot
 * have 102 components, and hand-maintained field lists are exactly how the
 * legacy app ended up with two 8,000-line grid configs.
 */
export const buildFacetDefinitions = (
  attributes: readonly FacetAttribute[],
): FacetDefinition[] =>
  attributes.flatMap((attribute) => {
    const allowKey = attribute.referenceColumn;
    const ref = allowKey ? resolveReferenceColumn(allowKey) : null;

    if (!allowKey || !ref) return [];

    const kind = facetKindFor(ref);

    if (!kind) return [];

    return [
      {
        attributeId: attribute.id,
        allowKey,
        label: attribute.label,
        icon: attribute.icon,
        group: COLUMN_META[allowKey]?.group ?? 'Identity',
        kind,
        type: ref.type,
        operators: operatorsFor(kind),
        isArray: ref.isArray === true,
        options: [],
      },
    ];
  });
