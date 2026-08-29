import type { AttributeType, SourceKind } from '@orm/app';

import { REFERENCE_COLUMNS } from '../attribute-types/reference-columns.js';
import {
  ADVISOR_REFERENCE_ATTRIBUTES,
  ADVISOR_WORKFLOW_ATTRIBUTES,
  FIRM_REFERENCE_ATTRIBUTES,
  FIRM_WORKFLOW_ATTRIBUTES,
} from './system-attributes.js';

export type SeedAttribute = {
  key: string;
  label: string;
  type: AttributeType;
  isMultiValue: boolean;
  /** set for projected columns; null for recruiter-authored ones */
  referenceColumn: string | null;
  isEditable: boolean;
  choices?: string[];
};

export type SeedEntity = {
  name: string;
  slug: string;
  sourceKind: SourceKind;
  attributes: SeedAttribute[];
};

const camel = (s: string): string => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** "firm_aum_per_advisor" -> "Firm Aum Per Advisor", then fixed up below */
const ACRONYMS: Record<string, string> = {
  Aum: 'AUM',
  Crd: 'CRD',
  Sec: 'SEC',
  Era: 'ERA',
  Cagr: 'CAGR',
  Tsv: 'TSV',
  '3Y': '3Y',
  '90D': '90d',
  '5Y': '5y',
};

const humanise = (column: string): string =>
  column
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .map((w) => ACRONYMS[w] ?? w)
    .join(' ');

/**
 * Reference attributes are derived from the allowlist rather than listed by
 * hand, so a column added to one cannot go missing from the other. The uuid7
 * key comes from the constant map, which is keyed by the same column name.
 */
const referenceAttributes = (
  source: 'advisor_search' | 'firm_search',
  keys: Record<string, string>,
): SeedAttribute[] =>
  [...REFERENCE_COLUMNS.entries()]
    .filter(([, ref]) => ref.source === source)
    .map(([allowKey, ref]) => {
      const key = keys[camel(ref.column)];

      if (!key) {
        throw new Error(`No system attribute key for ${allowKey}`);
      }

      return {
        key,
        label: humanise(ref.column),
        type: ref.type,
        isMultiValue: ref.isArray ?? false,
        referenceColumn: allowKey,
        // projected from market: there is no cell to write
        isEditable: false,
      };
    });

const RECRUITING_STAGES = [
  'Not Contacted',
  'Contacted',
  'Responded',
  'In Conversation',
  'Offer Made',
  'Signed',
  'Passed',
];

export const ADVISOR_ENTITY: SeedEntity = {
  name: 'Advisor',
  slug: 'advisor',
  sourceKind: 'advisor',
  attributes: [
    ...referenceAttributes('advisor_search', ADVISOR_REFERENCE_ATTRIBUTES),
    {
      key: ADVISOR_WORKFLOW_ATTRIBUTES.recruitingStatus,
      label: 'Recruiting Status',
      type: 'status',
      isMultiValue: false,
      referenceColumn: null,
      isEditable: true,
      choices: RECRUITING_STAGES,
    },
    {
      key: ADVISOR_WORKFLOW_ATTRIBUTES.owner,
      label: 'Owner',
      type: 'user',
      isMultiValue: false,
      referenceColumn: null,
      isEditable: true,
    },
    {
      key: ADVISOR_WORKFLOW_ATTRIBUTES.notes,
      label: 'Notes',
      type: 'text',
      isMultiValue: false,
      referenceColumn: null,
      isEditable: true,
    },
    {
      key: ADVISOR_WORKFLOW_ATTRIBUTES.lastContactedAt,
      label: 'Last Contacted',
      type: 'date',
      isMultiValue: false,
      referenceColumn: null,
      isEditable: true,
    },
    {
      key: ADVISOR_WORKFLOW_ATTRIBUTES.priority,
      label: 'Priority',
      type: 'rating',
      isMultiValue: false,
      referenceColumn: null,
      isEditable: true,
    },
  ],
};

export const FIRM_ENTITY: SeedEntity = {
  name: 'Firm',
  slug: 'firm',
  sourceKind: 'firm',
  attributes: [
    ...referenceAttributes('firm_search', FIRM_REFERENCE_ATTRIBUTES),
    {
      key: FIRM_WORKFLOW_ATTRIBUTES.targetStatus,
      label: 'Target Status',
      type: 'status',
      isMultiValue: false,
      referenceColumn: null,
      isEditable: true,
      choices: ['Untouched', 'Researching', 'Engaged', 'Partnered', 'Passed'],
    },
    {
      key: FIRM_WORKFLOW_ATTRIBUTES.owner,
      label: 'Owner',
      type: 'user',
      isMultiValue: false,
      referenceColumn: null,
      isEditable: true,
    },
    {
      key: FIRM_WORKFLOW_ATTRIBUTES.notes,
      label: 'Notes',
      type: 'text',
      isMultiValue: false,
      referenceColumn: null,
      isEditable: true,
    },
  ],
};

export const DEFAULT_ENTITIES: SeedEntity[] = [ADVISOR_ENTITY, FIRM_ENTITY];
