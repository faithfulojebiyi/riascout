import { z } from 'zod';

import { STORAGE_IMAGE_TYPES } from '@providers/storage/storage.service.js';
import { dateToString } from '@system/schema/utils.js';

/** what a workspace is here for; drives nothing yet beyond being recorded */
export const USE_CASES = [
  'recruiting',
  'succession',
  'asset_management_sales',
  'platform_sales',
  'consulting',
  'investing',
  'marketing',
  'other',
] as const;

export const INVITE_ROLES = ['admin', 'member'] as const;

/** a profile picture, not an asset library — 5MB is already generous */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export const MAX_INVITES = 10;

export const OnboardingPreferencesSchema = z
  .object({ useCases: z.array(z.enum(USE_CASES)).max(USE_CASES.length) })
  .meta({ id: 'OnboardingPreferences' });

export const OnboardingStateSchema = z
  .object({
    user: z.object({
      name: z.string(),
      email: z.email(),
      image: z.string().nullable(),
      marketingOptIn: z.boolean(),
      onboardedAt: dateToString.nullable(),
    }),
    workspace: z.object({
      id: z.string(),
      name: z.string(),
      logo: z.string().nullable(),
    }),
    preferences: OnboardingPreferencesSchema,
    /** emails already invited, so a re-run of the last step does not duplicate */
    pendingInvites: z.array(z.email()),
  })
  .meta({ id: 'OnboardingState' });

export const SaveProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().max(80).default(''),
    image: z.url().nullable().default(null),
    marketingOptIn: z.boolean().default(false),
  })
  .meta({ id: 'SaveProfile' });

export const SaveWorkspaceSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    logo: z.url().nullable().default(null),
  })
  .meta({ id: 'SaveWorkspace' });

export const SavePreferencesSchema = z
  .object({ useCases: z.array(z.enum(USE_CASES)).max(USE_CASES.length) })
  .meta({ id: 'SavePreferences' });

export const InviteTeammatesSchema = z
  .object({
    invites: z
      .array(
        z.object({
          email: z.email(),
          role: z.enum(INVITE_ROLES).default('member'),
        }),
      )
      .max(MAX_INVITES),
  })
  .meta({ id: 'InviteTeammates' });

export const InviteTeammatesResponseSchema = z
  .object({
    invited: z.number().int(),
    /** already a member or already invited — reported rather than failing the step */
    skipped: z.array(z.email()),
  })
  .meta({ id: 'InviteTeammatesResponse' });

export const UploadImageSchema = z
  .object({
    contentType: z.enum(STORAGE_IMAGE_TYPES),
    /**
     * base64 without the data-url prefix. A regex rather than z.base64(): that
     * emits contentEncoding, which is 3.1-only and fails orval's validator.
     */
    data: z
      .string()
      .regex(/^[A-Za-z0-9+/]+={0,2}$/)
      .max(Math.ceil(AVATAR_MAX_BYTES / 3) * 4),
  })
  .meta({ id: 'UploadImage' });

export const UploadImageResponseSchema = z
  .object({ url: z.url() })
  .meta({ id: 'UploadImageResponse' });

export const CompleteOnboardingResponseSchema = z
  .object({ onboardedAt: dateToString })
  .meta({ id: 'CompleteOnboardingResponse' });

/** stored as a json string in organization.metadata, which better-auth owns */
export const WorkspaceMetadataSchema = z
  .object({ useCases: z.array(z.enum(USE_CASES)).default([]) })
  .meta({ id: 'WorkspaceMetadata' });
