import { createZodDto } from 'nestjs-zod';

import {
  SearchAdvisorsResponseSchema,
  SearchAdvisorsSchema,
} from '../schema.js';

export class SearchAdvisorsDto extends createZodDto(SearchAdvisorsSchema) {}

// codec: true so dates serialize correctly
export class SearchAdvisorsResponseDto extends createZodDto(
  SearchAdvisorsResponseSchema,
  { codec: true },
) {}
