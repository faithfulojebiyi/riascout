import { createZodDto } from 'nestjs-zod';

import {
  CreateEntityRecordResponseSchema,
  GetEntitiesResponseSchema,
  GetEntitiesSchema,
  CreateEntityRecordSchema,
  GetEntityRecordResponseSchema,
  GetEntityRecordSchema,
  GetEntityRecordsResponseSchema,
  GetEntityRecordsSchema,
  MoveViewFieldResponseSchema,
  MoveViewFieldSchema,
  UpdateRecordValuesResponseSchema,
  UpdateRecordValuesSchema,
  UpdateViewFieldSchema,
  UpdateViewSortSchema,
} from '../schema.js';

export class GetEntityRecordsDto extends createZodDto(GetEntityRecordsSchema) {}

// codec: true so dates serialize correctly
export class GetEntityRecordsResponseDto extends createZodDto(
  GetEntityRecordsResponseSchema,
  { codec: true },
) {}

export class GetEntityRecordDto extends createZodDto(GetEntityRecordSchema) {}
export class GetEntityRecordResponseDto extends createZodDto(
  GetEntityRecordResponseSchema,
  { codec: true },
) {}

export class UpdateRecordValuesDto extends createZodDto(
  UpdateRecordValuesSchema,
) {}
export class UpdateRecordValuesResponseDto extends createZodDto(
  UpdateRecordValuesResponseSchema,
  { codec: true },
) {}

export class CreateEntityRecordDto extends createZodDto(
  CreateEntityRecordSchema,
) {}
export class CreateEntityRecordResponseDto extends createZodDto(
  CreateEntityRecordResponseSchema,
  { codec: true },
) {}

export class UpdateViewFieldDto extends createZodDto(UpdateViewFieldSchema) {}
export class UpdateViewSortDto extends createZodDto(UpdateViewSortSchema) {}
export class MoveViewFieldDto extends createZodDto(MoveViewFieldSchema) {}
export class MoveViewFieldResponseDto extends createZodDto(
  MoveViewFieldResponseSchema,
  { codec: true },
) {}

export class GetEntitiesDto extends createZodDto(GetEntitiesSchema) {}
export class GetEntitiesResponseDto extends createZodDto(
  GetEntitiesResponseSchema,
  {
    codec: true,
  },
) {}
