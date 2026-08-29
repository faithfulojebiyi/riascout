import { z } from 'zod';

/**
 * Filter and sort AST, stored as jsonb on entity_view.filter_tree / .sort.
 * Attributes are referenced by id; the compiler resolves them and is fail-soft
 * on missing ids, because attribute deletes do not cascade into json blobs.
 */
const PATH_MAX_HOPS = 3;

export const pathStepSchema = z.object({ attributeId: z.uuid() });
export type PathStep = z.infer<typeof pathStepSchema>;

export const pathSchema = z.array(pathStepSchema).min(1).max(PATH_MAX_HOPS);
export type AttributePath = z.infer<typeof pathSchema>;

export const filterOperatorSchema = z.enum([
  'is',
  'isNot',
  'contains',
  'notContains',
  'startsWith',
  'endsWith',
  'isEmpty',
  'isNotEmpty',
  'isLessThan',
  'isGreaterThan',
  'isBefore',
  'isAfter',
  'isBetween',
  'isWithinLastNDays',
  'isAnyOf',
  'isNoneOf',
]);
export type FilterOperator = z.infer<typeof filterOperatorSchema>;

export type FilterCondition = {
  kind: 'condition';
  path: AttributePath;
  operator: FilterOperator;
  /** operator-specific shape, refined by the operator registry's parseValue */
  value: unknown;
};

export type FilterAnd = { kind: 'and'; children: FilterTree[] };
export type FilterOr = { kind: 'or'; children: FilterTree[] };
export type FilterNot = { kind: 'not'; child: FilterTree };

export type FilterTree = FilterCondition | FilterAnd | FilterOr | FilterNot;

// z.union rather than discriminatedUnion: zod's discriminator inference fails
// on recursive members
export const filterTreeSchema: z.ZodType<FilterTree> = z.lazy(() =>
  z.union([
    z.object({
      kind: z.literal('condition'),
      path: pathSchema,
      operator: filterOperatorSchema,
      value: z.unknown(),
    }),
    z.object({
      kind: z.literal('and'),
      children: z.array(filterTreeSchema).min(1),
    }),
    z.object({
      kind: z.literal('or'),
      children: z.array(filterTreeSchema).min(1),
    }),
    z.object({ kind: z.literal('not'), child: filterTreeSchema }),
  ]),
);

export const sortDirectionSchema = z.enum(['asc', 'desc']);
export type SortDirection = z.infer<typeof sortDirectionSchema>;

export const sortSpecSchema = z.object({
  path: pathSchema,
  direction: sortDirectionSchema,
});
export type SortSpec = z.infer<typeof sortSpecSchema>;

/** multi-column sort; the compiler rejects 1:M and M:M hops to keep ordering deterministic */
export const sortAstSchema = z.array(sortSpecSchema);
export type SortAst = z.infer<typeof sortAstSchema>;
