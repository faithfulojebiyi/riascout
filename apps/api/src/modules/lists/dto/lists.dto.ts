import { createZodDto } from 'nestjs-zod';

import {
  AddToListResponseSchema,
  AddToListSchema,
  CreateListResponseSchema,
  CreateListSchema,
  GetListsResponseSchema,
  GetListsSchema,
} from '../schema.js';

export class GetListsDto extends createZodDto(GetListsSchema) {}
export class CreateListDto extends createZodDto(CreateListSchema) {}
export class AddToListDto extends createZodDto(AddToListSchema) {}

// codec: true so dates serialize correctly
export class GetListsResponseDto extends createZodDto(GetListsResponseSchema, {
  codec: true,
}) {}
export class CreateListResponseDto extends createZodDto(
  CreateListResponseSchema,
  { codec: true },
) {}
export class AddToListResponseDto extends createZodDto(
  AddToListResponseSchema,
  {
    codec: true,
  },
) {}
