import { createZodDto } from 'nestjs-zod';

import {
  GetAdvisorProfileResponseSchema,
  GetAdvisorProfileSchema,
} from '../schema.js';

export class GetAdvisorProfileDto extends createZodDto(
  GetAdvisorProfileSchema,
) {}

// codec: true so dates serialize correctly
export class GetAdvisorProfileResponseDto extends createZodDto(
  GetAdvisorProfileResponseSchema,
  { codec: true },
) {}
