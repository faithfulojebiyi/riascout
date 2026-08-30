import { BooleanFacet } from './boolean-facet';
import { DateFacet } from './date-facet';
import { MultiSelectFacet, type FacetInputProps } from './multi-select-facet';
import { NumberFacet } from './number-facet';
import { SearchFacet } from './search-facet';

/**
 * One dispatcher on facet kind, mirroring how the backend's operator registry
 * dispatches on attribute type. 102 allowlisted columns share five kinds, so a
 * new column gets a working facet with no new component.
 */
export const FacetInput = (props: FacetInputProps) => {
  switch (props.facet.kind) {
    case 'multiSelect':
      return <MultiSelectFacet {...props} />;
    case 'boolean':
      return <BooleanFacet {...props} />;
    case 'number':
      return <NumberFacet {...props} />;
    case 'date':
      return <DateFacet {...props} />;
    case 'search':
      return <SearchFacet {...props} />;
    default:
      return null;
  }
};
