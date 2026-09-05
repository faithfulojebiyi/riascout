import { createZodDto } from 'nestjs-zod';

import { GetJobResponseSchema, GetJobSchema } from '../schema.js';

export class GetJobDto extends createZodDto(GetJobSchema) {}
export class GetJobResponseDto extends createZodDto(GetJobResponseSchema, {
  codec: true,
}) {}
