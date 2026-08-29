import type { AttributeType, SourceKind } from '@orm/app';

import { REFERENCE_COLUMNS } from '../attribute-types/reference-columns.js';
import {
  ATTRIBUTE_GROUPS,
  COLUMN_META,
  FALLBACK_GROUP,
  type AttributeGroup,
} from './column-meta.js';
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
  group: AttributeGroup;
  /** a column in the default grid; the rest are switched on from grid settings */
  visible: boolean;
  pinned: boolean;
  /** the record's display name — one per entity */
  isPrimary: boolean;
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
  Crds: 'CRDs',
  Sec: 'SEC',
  Era: 'ERA',
  Cagr: 'CAGR',
  Url: 'URL',
  Linkedin: 'LinkedIn',
  Us: 'US',
  Gav: 'GAV',
  Ids: 'IDs',
  Id: 'ID',
  '1Y': '1Y',
  '3Y': '3Y',
  '5Y': '5Y',
  '90D': '90d',
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

      const meta = COLUMN_META[allowKey];

      return {
        key,
        label: humanise(ref.column),
        type: ref.type,
        isMultiValue: ref.isArray ?? false,
        referenceColumn: allowKey,
        // projected from market: there is no cell to write
        isEditable: false,
        group: meta?.group ?? FALLBACK_GROUP[source],
        visible: meta?.visible ?? false,
        pinned: meta?.pinned ?? false,
        isPrimary: meta?.primary ?? false,
      };
    });

/** groups appear in the order declared, so the record panel reads top to bottom */
const byGroup = (attributes: SeedAttribute[]): SeedAttribute[] =>
  [...attributes].sort(
    (a, b) => ATTRIBUTE_GROUPS.indexOf(a.group) - ATTRIBUTE_GROUPS.indexOf(b.group),
  );

const RECRUITING_STAGES = [
  'Not Contacted',
  'Contacted',
  'Responded',
  'In Conversation',
  'Offer Made',
  'Signed',
  'Passed',
];

type WorkflowSpec = Omit<
  SeedAttribute,
  'referenceColumn' | 'isEditable' | 'isMultiValue' | 'isPrimary'
> &
  Partial<Pick<SeedAttribute, 'isMultiValue' | 'isPrimary'>>;

/** recruiter-authored: stored as cells, editable, never projected */
const workflow = (spec: WorkflowSpec): SeedAttribute => ({
  isMultiValue: false,
  isPrimary: false,
  ...spec,
  referenceColumn: null,
  isEditable: true,
});

/**
 * Contact channels exist before the enrichment module does. A recruiter can
 * paste a LinkedIn URL today, and when enrichment lands it writes the same
 * cells with source set — where the cell writer's rule already stops it
 * overwriting anything a human entered.
 */
const ADVISOR_CONTACT: SeedAttribute[] = [
  workflow({
    key: ADVISOR_WORKFLOW_ATTRIBUTES.linkedinUrl,
    label: 'LinkedIn',
    type: 'url',
    group: 'Contact',
    visible: true,
    pinned: false,
  }),
  workflow({
    key: ADVISOR_WORKFLOW_ATTRIBUTES.personalEmail,
    label: 'Personal Email',
    type: 'email',
    group: 'Contact',
    visible: false,
    pinned: false,
  }),
  workflow({
    key: ADVISOR_WORKFLOW_ATTRIBUTES.mobilePhone,
    label: 'Mobile Phone',
    type: 'phone',
    group: 'Contact',
    visible: false,
    pinned: false,
  }),
  workflow({
    key: ADVISOR_WORKFLOW_ATTRIBUTES.twitterUrl,
    label: 'X / Twitter',
    type: 'url',
    group: 'Contact',
    visible: false,
    pinned: false,
  }),
  workflow({
    key: ADVISOR_WORKFLOW_ATTRIBUTES.facebookUrl,
    label: 'Facebook',
    type: 'url',
    group: 'Contact',
    visible: false,
    pinned: false,
  }),
  workflow({
    key: ADVISOR_WORKFLOW_ATTRIBUTES.doNotContact,
    label: 'Do Not Contact',
    type: 'checkbox',
    group: 'Contact',
    visible: true,
    pinned: false,
  }),
];

const ADVISOR_PIPELINE: SeedAttribute[] = [
  workflow({
    key: ADVISOR_WORKFLOW_ATTRIBUTES.recruitingStatus,
    label: 'Recruiting Status',
    type: 'status',
    group: 'Pipeline',
    visible: true,
    pinned: false,
    choices: RECRUITING_STAGES,
  }),
  workflow({
    key: ADVISOR_WORKFLOW_ATTRIBUTES.owner,
    label: 'Owner',
    type: 'user',
    group: 'Pipeline',
    visible: true,
    pinned: false,
  }),
  workflow({
    key: ADVISOR_WORKFLOW_ATTRIBUTES.priority,
    label: 'Priority',
    type: 'rating',
    group: 'Pipeline',
    visible: false,
    pinned: false,
  }),
  workflow({
    key: ADVISOR_WORKFLOW_ATTRIBUTES.lastContactedAt,
    label: 'Last Contacted',
    type: 'date',
    group: 'Pipeline',
    visible: false,
    pinned: false,
  }),
  workflow({
    key: ADVISOR_WORKFLOW_ATTRIBUTES.notes,
    label: 'Notes',
    type: 'text',
    group: 'Pipeline',
    visible: false,
    pinned: false,
  }),
];

export const ADVISOR_ENTITY: SeedEntity = {
  name: 'Advisor',
  slug: 'advisor',
  sourceKind: 'advisor',
  attributes: byGroup([
    ...referenceAttributes('advisor_search', ADVISOR_REFERENCE_ATTRIBUTES),
    ...ADVISOR_PIPELINE,
    ...ADVISOR_CONTACT,
  ]),
};

export const FIRM_ENTITY: SeedEntity = {
  name: 'Firm',
  slug: 'firm',
  sourceKind: 'firm',
  attributes: byGroup([
    ...referenceAttributes('firm_search', FIRM_REFERENCE_ATTRIBUTES),
    workflow({
      key: FIRM_WORKFLOW_ATTRIBUTES.targetStatus,
      label: 'Target Status',
      type: 'status',
      group: 'Pipeline',
      visible: true,
      pinned: false,
      choices: ['Untouched', 'Researching', 'Engaged', 'Partnered', 'Passed'],
    }),
    workflow({
      key: FIRM_WORKFLOW_ATTRIBUTES.owner,
      label: 'Owner',
      type: 'user',
      group: 'Pipeline',
      visible: true,
      pinned: false,
    }),
    workflow({
      key: FIRM_WORKFLOW_ATTRIBUTES.notes,
      label: 'Notes',
      type: 'text',
      group: 'Pipeline',
      visible: false,
      pinned: false,
    }),
  ]),
};

export const DEFAULT_ENTITIES: SeedEntity[] = [ADVISOR_ENTITY, FIRM_ENTITY];
