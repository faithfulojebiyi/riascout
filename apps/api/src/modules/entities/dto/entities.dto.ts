import { createZodDto } from 'nestjs-zod';

import { GetEntityRecordsResponseSchema, GetEntityRecordsSchema } from '../schema.js';

export class GetEntityRecordsDto extends createZodDto(GetEntityRecordsSchema) {}

// codec: true so dates serialize correctly
export class GetEntityRecordsResponseDto extends createZodDto(GetEntityRecordsResponseSchema, { codec: true }) {}
