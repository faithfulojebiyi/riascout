import { z } from 'zod';

import { crdSchema } from '@system/schema/utils.js';

/**
 * One endpoint rather than one per tab, which is the opposite of the firms
 * module and for a measured reason: an adviser has a median of 2 registrations
 * and 4 employment rows, and the worst case in the whole table is 100 and 92.
 * A firm's current filing can carry 22,277 custodian rows.
 */
export const GetAdvisorProfileSchema = z
  .object({ advisorCrd: crdSchema })
  .meta({ id: 'GetAdvisorProfile' });

const count = z.number().int().nullable();

/**
 * One stint, not one firm. 25,056 advisers hold both a current and a previous
 * registration at the same firm — they left and came back — so collapsing by
 * firm alone would report one continuous tenure that never happened.
 */
const AdvisorStintSchema = z
  .object({
    firmCrd: z.string(),
    /**
     * As the registration reported it, not today's canonical name. A firm that
     * renamed since would otherwise show its current name on a stint that ended
     * years before the change.
     */
    firmName: z.string().nullable(),
    startedOn: z.string().nullable(),
    /** null while any jurisdiction is still open */
    endedOn: z.string().nullable(),
    isCurrent: z.boolean(),
    /** registrations sit at jurisdiction grain; this is how many were folded */
    jurisdictionCount: z.number().int(),
    jurisdictions: z.array(z.string()),
    /** set when the firm is already saved in this workspace */
    recordId: z.uuid().nullable(),
  })
  .meta({ id: 'AdvisorStint' });

/**
 * Self-reported on the U4 and covers non-industry work too, so it is a
 * different claim from a registration and is never merged with one.
 */
const AdvisorEmploymentSchema = z
  .object({
    employerName: z.string().nullable(),
    city: z.string().nullable(),
    region: z.string().nullable(),
    /** month precision in the source; never widened to a day */
    startMonth: z.string().nullable(),
    endMonth: z.string().nullable(),
    isOpenEnded: z.boolean(),
  })
  .meta({ id: 'AdvisorEmployment' });

const AdvisorExamSchema = z
  .object({
    code: z.string(),
    takenOn: z.string().nullable(),
  })
  .meta({ id: 'AdvisorExam' });

/**
 * anyReported is null when no disclosure row exists at all. That is "we have
 * not looked", which is not the same as a clean record — the nine flags are
 * only meaningful once the row is there.
 */
const AdvisorDisclosuresSchema = z
  .object({
    anyReported: z.boolean().nullable(),
    reported: z.array(z.string()),
    count: count,
  })
  .meta({ id: 'AdvisorDisclosures' });

export const GetAdvisorProfileResponseSchema = z
  .object({
    stints: z.array(AdvisorStintSchema),
    employment: z.array(AdvisorEmploymentSchema),
    exams: z.array(AdvisorExamSchema),
    designations: z.array(z.string()),
    jurisdictions: z.array(z.string()),
    disclosures: AdvisorDisclosuresSchema,
    experienceMonths: count,
    tenureMonths: count,
  })
  .meta({ id: 'GetAdvisorProfileResponse' });
