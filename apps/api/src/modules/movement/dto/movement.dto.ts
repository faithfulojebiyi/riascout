import { createZodDto } from 'nestjs-zod';

import {
  GetFirmFlowsResponseSchema,
  GetFirmFlowsSchema,
  GetFirmMovesResponseSchema,
  GetFirmMovesSchema,
} from '../schema.js';

export class GetFirmFlowsDto extends createZodDto(GetFirmFlowsSchema) {}
export class GetFirmMovesDto extends createZodDto(GetFirmMovesSchema) {}

// codec: true so dates serialize correctly
export class GetFirmFlowsResponseDto extends createZodDto(
  GetFirmFlowsResponseSchema,
  { codec: true },
) {}
export class GetFirmMovesResponseDto extends createZodDto(
  GetFirmMovesResponseSchema,
  { codec: true },
) {}
