import { createZodDto } from 'nestjs-zod';

import {
  GetFacetsResponseSchema,
  GetFacetsSchema,
  SearchFacetOptionsResponseSchema,
  SearchFacetOptionsSchema,
  SearchAdvisorsResponseSchema,
  SearchAdvisorsSchema,
} from '../schema.js';

export class SearchAdvisorsDto extends createZodDto(SearchAdvisorsSchema) {}

// codec: true so dates serialize correctly
export class SearchAdvisorsResponseDto extends createZodDto(
  SearchAdvisorsResponseSchema,
  { codec: true },
) {}

export class GetFacetsDto extends createZodDto(GetFacetsSchema) {}
export class GetFacetsResponseDto extends createZodDto(
  GetFacetsResponseSchema,
  { codec: true },
) {}

export class SearchFacetOptionsDto extends createZodDto(
  SearchFacetOptionsSchema,
) {}
export class SearchFacetOptionsResponseDto extends createZodDto(
  SearchFacetOptionsResponseSchema,
  { codec: true },
) {}
