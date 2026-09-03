import { z } from 'zod';

import { filterOperatorSchema } from '@feature/entities/filter-sort/ast.js';

/**
 * The model-facing filter. Fields are allowlist keys such as
 * "advisor.state", never attribute ids. Two flat groups instead of a recursive
 * tree: every recruiting question so far is "all of these, and any of those",
 * and a non-recursive schema converts to JSON Schema without $ref.
 */
export const agentConditionSchema = z
  .object({
    field: z.string().min(1).describe('Field key from the field dictionary'),
    op: filterOperatorSchema,
    value: z
      .unknown()
      .optional()
      .describe(
        'Operator-specific: isAnyOf/isNoneOf take a string array; isBetween takes [low, high]; isWithinLastNDays takes a positive integer; isEmpty/isNotEmpty take nothing',
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
  })
  .meta({ id: 'AgentFilter' });

export type AgentFilter = z.infer<typeof agentFilterSchema>;
