import { z } from 'zod';

/**
 * What the assistant may remember about a recruiter across conversations.
 * Values are option values from the field dictionary (state codes, band and
 * channel codes, designation names), never labels, so memory can be applied
 * to a filter without translation. Every field is optional: Mastra merges
 * updates, and an absent field means "no preference stated".
 */
export const recruiterProfileSchema = z
  .object({
    territory: z
      .array(z.string())
      .optional()
      .describe('state codes the recruiter covers, e.g. ["TX", "OK"]'),
    targetAumBands: z
      .array(z.string())
      .optional()
      .describe('firm AUM band codes they usually target, e.g. ["1b_5b"]'),
    credentials: z
      .array(z.string())
      .optional()
      .describe('designation names or exam codes they look for'),
    firmTypes: z
      .array(z.string())
      .optional()
      .describe('channel codes they recruit from, e.g. ["pure_ria", "hybrid"]'),
    firmsRecruitedFor: z
      .array(
        z.object({
          name: z.string(),
          crd: z.string().optional(),
        }),
      )
      .optional()
      .describe('firms the recruiter places advisers at'),
    outputPreferences: z
      .object({
        rowLimit: z.number().int().min(1).max(25).optional(),
        preferTables: z.boolean().optional(),
      })
      .optional(),
    notes: z
      .string()
      .max(600)
      .optional()
      .describe('anything durable the recruiter asked you to keep in mind'),
  })
  .meta({ id: 'RecruiterProfile' });

export type RecruiterProfile = z.output<typeof recruiterProfileSchema>;
