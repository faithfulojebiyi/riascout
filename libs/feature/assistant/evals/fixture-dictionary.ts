import { REFERENCE_COLUMNS } from '@feature/entities/attribute-types/reference-columns.js';
import type { AttributeMeta } from '@feature/entities/relationship-edges.js';
import {
  buildFacetDefinitions,
  type FacetDefinition,
  type FacetOption,
} from '@feature/prospecting/facets/facet-definitions.js';

import {
  buildFieldDictionary,
  type FieldDictionary,
} from '../filter/field-dictionary.js';

const STATES = ['TX', 'CA', 'FL', 'NY', 'NJ', 'CT', 'IL', 'MA', 'PA', 'GA'];
const AUM_BANDS: FacetOption[] = [
  ['lt_25m', 'Under $25M'],
  ['25m_100m', '$25M – $100M'],
  ['100m_250m', '$100M – $250M'],
  ['250m_500m', '$250M – $500M'],
  ['500m_1b', '$500M – $1B'],
  ['1b_5b', '$1B – $5B'],
  ['5b_20b', '$5B – $20B'],
  ['gte_20b', '$20B+'],
].map(([value, label]) => ({ value: value as string, label: label as string }));
const CHANNELS: FacetOption[] = [
  ['pure_ria', 'Pure RIA – no broker-dealer'],
  ['hybrid', 'Hybrid – RIA with a broker-dealer affiliation'],
  ['bd_affiliated', 'Broker-dealer affiliated'],
  ['insurance_affiliated', 'Insurance affiliated'],
  ['bank_affiliated', 'Bank affiliated'],
  ['era', 'Exempt reporting adviser'],
].map(([value, label]) => ({ value: value as string, label: label as string }));
/** IAPD exam codes are stable; designation names must be checked against market.facet_option */
const EXAMS = ['S7', 'S65', 'S66', 'S63', 'S24', 'SIE', 'S79'];
export const DESIGNATIONS = [
  'Certified Financial Planner (CFP)',
  'Chartered Financial Analyst (CFA)',
  'Chartered Financial Consultant (ChFC)',
  'Certified Public Accountant (CPA)',
  'Certified Investment Management Analyst (CIMA)',
];

const CANNED_OPTIONS: Readonly<Record<string, FacetOption[]>> = {
  'advisor.state': STATES.map((value) => ({ value, label: value })),
  'advisor.firm_state': STATES.map((value) => ({ value, label: value })),
  'firm.state': STATES.map((value) => ({ value, label: value })),
  'advisor.firm_aum_band': AUM_BANDS,
  'firm.aum_band': AUM_BANDS,
  'advisor.firm_channel': CHANNELS,
  'firm.channel_code': CHANNELS,
  'advisor.exam_codes': EXAMS.map((value) => ({ value, label: value })),
  'advisor.designations': DESIGNATIONS.map((value) => ({
    value,
    label: value,
  })),
  'advisor.disclosure_status': [
    { value: 'has_disclosure', label: 'Has disclosure' },
    { value: 'none_reported', label: 'None reported' },
    { value: 'unknown', label: 'Unknown' },
  ],
  'advisor.current_firm_source': [
    { value: 'registration', label: 'Registration' },
    { value: 'observation', label: 'Observation' },
  ],
  'firm.advisor_linkage_status': [
    { value: 'linked', label: 'Linked' },
    { value: 'self_reported_only', label: 'Self-reported only' },
    { value: 'unknown', label: 'Unknown' },
  ],
};

/** deterministic ids so expected trees can be written by hand */
export const attributeIdFor = (allowKey: string): string => `attr:${allowKey}`;

/**
 * Every allowlist column as a facet, the way a fully provisioned workspace
 * would expose it, with canned option vocabularies for the fields the golden
 * prompts rely on. No database involved.
 */
export const buildFixtureFacets = (
  sourceKind: 'advisor' | 'firm',
): FacetDefinition[] => {
  const prefix = `${sourceKind}.`;
  const attributes = [...REFERENCE_COLUMNS.keys()]
    .filter((allowKey) => allowKey.startsWith(prefix))
    .map((allowKey) => ({
      id: attributeIdFor(allowKey),
      label: allowKey.slice(prefix.length).replaceAll('_', ' '),
      icon: null,
      referenceColumn: allowKey,
    }));

  return buildFacetDefinitions(attributes).map((facet) => ({
    ...facet,
    options: CANNED_OPTIONS[facet.allowKey] ?? [],
  }));
};

export const fixtureDictionary = (
  sourceKind: 'advisor' | 'firm',
): FieldDictionary => buildFieldDictionary(buildFixtureFacets(sourceKind));

/** what the SQL compiler needs to resolve the fixture's attribute ids */
export const fixtureAttributeMeta = (
  sourceKind: 'advisor' | 'firm',
): Map<string, AttributeMeta> =>
  new Map(
    buildFixtureFacets(sourceKind).map((facet) => [
      facet.attributeId,
      {
        id: facet.attributeId,
        entityId: `entity:${sourceKind}`,
        type: facet.type,
        isMultiValue: facet.isArray,
        relationshipType: null,
        isCanonicalSide: null,
        otherRelationshipSideAttributeId: null,
        referenceColumn: facet.allowKey,
      },
    ]),
  );
