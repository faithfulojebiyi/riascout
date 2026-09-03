import type { FacetDefinition } from '@feature/prospecting/facets/facet-definitions.js';

export type FieldDictionary = ReadonlyMap<string, FacetDefinition>;

const OPTION_PREVIEW = 12;

export const buildFieldDictionary = (
  facets: readonly FacetDefinition[],
): FieldDictionary => new Map(facets.map((facet) => [facet.allowKey, facet]));

/**
 * One line per field, sorted by key. The text lands in the cached system
 * prefix, so it must be byte-stable for a given workspace: no timestamps, no
 * insertion-order dependence.
 */
export const renderFieldDictionary = (dictionary: FieldDictionary): string =>
  [...dictionary.values()]
    .sort((a, b) => a.allowKey.localeCompare(b.allowKey))
    .map((facet) => {
      const options = facet.options
        .slice(0, OPTION_PREVIEW)
        .map((option) =>
          option.label === option.value
            ? option.value
            : `${option.value} (${option.label})`,
        );
      const more = facet.options.length - OPTION_PREVIEW;
      const optionText =
        options.length === 0
          ? facet.kind === 'search'
            ? 'free text values'
            : ''
          : `${options.join(', ')}${more > 0 ? `, +${more} more` : ''}`;

      return [
        facet.allowKey,
        facet.label,
        facet.kind,
        facet.operators.join('/'),
        optionText,
      ]
        .filter((part) => part !== '')
        .join(' | ');
    })
    .join('\n');
