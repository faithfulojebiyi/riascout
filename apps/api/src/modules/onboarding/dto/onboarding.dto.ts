import { createZodDto } from 'nestjs-zod';

import {
  CompleteOnboardingResponseSchema,
  InviteTeammatesResponseSchema,
  InviteTeammatesSchema,
  OnboardingStateSchema,
  SavePreferencesSchema,
  SaveProfileSchema,
  SaveWorkspaceSchema,
  UploadImageResponseSchema,
  UploadImageSchema,
} from '../schema.js';

export class SaveProfileDto extends createZodDto(SaveProfileSchema) {}
export class SaveWorkspaceDto extends createZodDto(SaveWorkspaceSchema) {}
export class SavePreferencesDto extends createZodDto(SavePreferencesSchema) {}
export class InviteTeammatesDto extends createZodDto(InviteTeammatesSchema) {}
export class UploadImageDto extends createZodDto(UploadImageSchema) {}

// codec: true so dates serialize correctly
export class OnboardingStateDto extends createZodDto(OnboardingStateSchema, {
  codec: true,
}) {}
export class InviteTeammatesResponseDto extends createZodDto(
  InviteTeammatesResponseSchema,
  { codec: true },
) {}
export class UploadImageResponseDto extends createZodDto(
  UploadImageResponseSchema,
  { codec: true },
) {}
export class CompleteOnboardingResponseDto extends createZodDto(
  CompleteOnboardingResponseSchema,
  { codec: true },
) {}
