import { createZodDto } from 'nestjs-zod';

import {
  CreateEntityRecordResponseSchema,
  CreateEntityRecordSchema,
  GetEntityRecordsResponseSchema,
  GetEntityRecordsSchema,
  UpdateRecordValuesResponseSchema,
  UpdateRecordValuesSchema,
} from '../schema.js';

export class GetEntityRecordsDto extends createZodDto(GetEntityRecordsSchema) {}

// codec: true so dates serialize correctly
export class GetEntityRecordsResponseDto extends createZodDto(GetEntityRecordsResponseSchema, { codec: true }) {}

export class UpdateRecordValuesDto extends createZodDto(UpdateRecordValuesSchema) {}
export class UpdateRecordValuesResponseDto extends createZodDto(
  UpdateRecordValuesResponseSchema,
  { codec: true },
) {}

export class CreateEntityRecordDto extends createZodDto(CreateEntityRecordSchema) {}
export class CreateEntityRecordResponseDto extends createZodDto(
  CreateEntityRecordResponseSchema,
  { codec: true },
) {}
