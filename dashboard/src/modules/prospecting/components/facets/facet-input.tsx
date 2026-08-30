import { BooleanFacet } from './boolean-facet';
import { DateFacet } from './date-facet';
import { MultiSelectFacet, type FacetInputProps } from './multi-select-facet';
import { NumberFacet } from './number-facet';
import { Span } from '../../../../ui/primitives/text';

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
      // the options endpoint is not built yet; say so rather than render dead UI
      return (
        <Span color="text.placeholder" fontSize="sm">
          Lookup coming soon
        </Span>
      );
    default:
      return null;
  }
};
