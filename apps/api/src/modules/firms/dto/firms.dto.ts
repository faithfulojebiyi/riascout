import { createZodDto } from 'nestjs-zod';

import {
  GetFirmContactsResponseSchema,
  GetFirmContactsSchema,
  GetFirmCustodiansResponseSchema,
  GetFirmCustodiansSchema,
  GetFirmFilingsResponseSchema,
  GetFirmFilingsSchema,
  GetFirmFundsResponseSchema,
  GetFirmFundsSchema,
  GetFirmMetricsSeriesResponseSchema,
  GetFirmMetricsSeriesSchema,
  GetFirmOfficesResponseSchema,
  GetFirmOfficesSchema,
  GetFirmProfileResponseSchema,
  GetFirmProfileSchema,
} from '../schema.js';

export class GetFirmMetricsSeriesDto extends createZodDto(
  GetFirmMetricsSeriesSchema,
) {}

// codec: true so dates serialize correctly
export class GetFirmMetricsSeriesResponseDto extends createZodDto(
  GetFirmMetricsSeriesResponseSchema,
  { codec: true },
) {}

export class GetFirmCustodiansDto extends createZodDto(
  GetFirmCustodiansSchema,
) {}
export class GetFirmCustodiansResponseDto extends createZodDto(
  GetFirmCustodiansResponseSchema,
  { codec: true },
) {}

export class GetFirmProfileDto extends createZodDto(GetFirmProfileSchema) {}
export class GetFirmProfileResponseDto extends createZodDto(
  GetFirmProfileResponseSchema,
  { codec: true },
) {}

export class GetFirmOfficesDto extends createZodDto(GetFirmOfficesSchema) {}
export class GetFirmOfficesResponseDto extends createZodDto(
  GetFirmOfficesResponseSchema,
  { codec: true },
) {}

export class GetFirmFundsDto extends createZodDto(GetFirmFundsSchema) {}
export class GetFirmFundsResponseDto extends createZodDto(
  GetFirmFundsResponseSchema,
  { codec: true },
) {}

export class GetFirmContactsDto extends createZodDto(GetFirmContactsSchema) {}
export class GetFirmContactsResponseDto extends createZodDto(
  GetFirmContactsResponseSchema,
  { codec: true },
) {}

export class GetFirmFilingsDto extends createZodDto(GetFirmFilingsSchema) {}
export class GetFirmFilingsResponseDto extends createZodDto(
  GetFirmFilingsResponseSchema,
  { codec: true },
) {}
