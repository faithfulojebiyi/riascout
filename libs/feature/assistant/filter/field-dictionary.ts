import { glossaryFor } from '@feature/entities/data/column-glossary.js';
import type { FacetDefinition } from '@feature/prospecting/facets/facet-definitions.js';

import { agentOperatorsFor } from './agent-operators.js';

export type FieldDictionary = ReadonlyMap<string, FacetDefinition>;

const OPTION_PREVIEW = 12;

/** vocabularies the model needs spelled out, because guessing them fails silently */
const PREVIEW_OVERRIDES: Readonly<Record<string, number>> = {
  'advisor.designations': 20,
  'advisor.exam_codes': 20,
};

export const DICTIONARY_COLUMNS =
  'key | label | kind | operators | unit | meaning | aka | null means | option values';

export const buildFieldDictionary = (
  facets: readonly FacetDefinition[],
): FieldDictionary => new Map(facets.map((facet) => [facet.allowKey, facet]));

const renderOptions = (facet: FacetDefinition): string => {
  const preview = PREVIEW_OVERRIDES[facet.allowKey] ?? OPTION_PREVIEW;
  const options = facet.options
    .slice(0, preview)
    .map((option) =>
      option.label === option.value
        ? option.value
        : `${option.value} (${option.label})`,
    );
  const more = facet.options.length - preview;

  if (options.length === 0) {
    return facet.kind === 'search'
      ? 'free text; resolve with get_field_options'
      : '';
  }

  return `${options.join(', ')}${more > 0 ? `, +${more} more` : ''}`;
};

/**
 * One line per field, sorted by key. The text lands in the cached system
 * prefix, so it must be byte-stable for a given workspace: static glossary,
 * static operator sets, no timestamps, no insertion-order dependence.
 */
export const renderFieldDictionary = (dictionary: FieldDictionary): string =>
  [...dictionary.values()]
    .sort((a, b) => a.allowKey.localeCompare(b.allowKey))
    .map((facet) => {
      const glossary = glossaryFor(facet.allowKey);

      return [
        facet.allowKey,
        facet.label,
        facet.kind,
        agentOperatorsFor(facet).join('/'),
        glossary?.unit ?? '',
        glossary?.description ?? facet.description ?? '',
        glossary?.aliases?.length ? `aka: ${glossary.aliases.join(', ')}` : '',
        glossary?.nulls ? `null: ${glossary.nulls}` : '',
        renderOptions(facet),
      ]
        .filter((part) => part !== '')
        .join(' | ');
    })
    .join('\n');

/** the two entity vocabularies, each under its own heading */
export const renderDictionarySections = (sections: {
  advisor: FieldDictionary;
  firm: FieldDictionary;
}): string =>
  [
    `Adviser fields (search_advisers)\n${renderFieldDictionary(sections.advisor)}`,
    `Firm fields (search_firms)\n${renderFieldDictionary(sections.firm)}`,
  ].join('\n\n');
