import { z } from 'zod';

import { filterOperatorSchema } from '@feature/entities/filter-sort/ast.js';

/**
 * The model-facing filter. Fields are allowlist keys such as
 * "advisor.state", never attribute ids. Three flat groups instead of a
 * recursive tree: recruiting questions are "all of these, any of those, none
 * of the others", and a non-recursive schema converts to JSON Schema without
 * $ref.
 */
export const agentConditionSchema = z
  .object({
    field: z.string().min(1).describe('Field key from the field dictionary'),
    op: filterOperatorSchema,
    value: z
      .unknown()
      .optional()
      .describe(
        'By operator: isAnyOf/isNoneOf take an array of option values; isBetween takes [low, high]; isWithinLastNDays takes a whole number of days; isAfter/isBefore take an ISO date; numeric operators take a plain number (2000000000, not "$2B"); isEmpty/isNotEmpty take nothing',
      ),
  })
  .meta({ id: 'AgentCondition' });

export type AgentCondition = z.infer<typeof agentConditionSchema>;

export const agentFilterSchema = z
  .object({
    all: z
      .array(agentConditionSchema)
      .default([])
      .describe('Every condition must match'),
    any: z
      .array(agentConditionSchema)
      .default([])
      .describe('At least one condition must match'),
    none: z
      .array(agentConditionSchema)
      .default([])
      .describe('Rows matching any of these are excluded'),
  })
  .meta({ id: 'AgentFilter' });

export type AgentFilter = z.infer<typeof agentFilterSchema>;

export type AgentFilterGroup = 'all' | 'any' | 'none';
