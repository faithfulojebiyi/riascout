import { z } from 'zod';

/** windows a recruiter actually asks for; an arbitrary range is a later concern */
const windowDays = z.union([
  z.literal(30),
  z.literal(90),
  z.literal(180),
  z.literal(365),
]);

export const GetFirmFlowsSchema = z
  .object({
    windowDays: windowDays.default(90),
    /** gaining firms first by default; losing firms are the other half of the story */
    direction: z.enum(['gaining', 'losing']).default('gaining'),
    limit: z.number().int().min(1).max(100).default(25),
  })
  .meta({ id: 'GetFirmFlows' });

const FirmFlowSchema = z
  .object({
    firmCrd: z.string(),
    firmName: z.string().nullable(),
    advisorsGained: z.number().int(),
    advisorsLost: z.number().int(),
    netFlow: z.number().int(),
  })
  .meta({ id: 'FirmFlow' });

export const GetFirmFlowsResponseSchema = z
  .object({
    firms: z.array(FirmFlowSchema),
    /** the window these numbers describe, so a caller cannot mislabel them */
    windowDays: z.number().int(),
    /** valid time, not detection: every bootstrap move was detected on one day */
    basis: z.literal('occurred_on'),
  })
  .meta({ id: 'GetFirmFlowsResponse' });

export const GetFirmMovesSchema = z
  .object({
    firmCrd: z.string().regex(/^\d+$/),
    windowDays: windowDays.default(90),
    direction: z.enum(['in', 'out']).default('in'),
    limit: z.number().int().min(1).max(200).default(50),
  })
  .meta({ id: 'GetFirmMoves' });

const FirmMoveSchema = z
  .object({
    advisorCrd: z.string(),
    advisorName: z.string().nullable(),
    counterpartyCrd: z.string().nullable(),
    counterpartyName: z.string().nullable(),
    occurredOn: z.iso.date().nullable(),
    tenureDays: z.number().int().nullable(),
  })
  .meta({ id: 'FirmMove' });

export const GetFirmMovesResponseSchema = z
  .object({ moves: z.array(FirmMoveSchema) })
  .meta({ id: 'GetFirmMovesResponse' });
