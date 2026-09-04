import { z } from 'zod';

import type { SortAst } from '@feature/entities/filter-sort/ast.js';

import {
  agentFilterSchema,
  type AgentFilter,
} from '../filter/agent-filter.schema.js';
import {
  compileAgentFilter,
  type AgentFilterError,
} from '../filter/compile-agent-filter.js';
import {
  buildFieldDictionary,
  type FieldDictionary,
} from '../filter/field-dictionary.js';
import type { SourceKind, ToolContext } from './define-tool.js';

export const PROSPECT_ROWS_MAX = 25;
export const PROSPECT_OFFSET_MAX = 200;
export const EXTRA_COLUMNS_MAX = 6;

const SORTABLE_TYPES = new Set([
  'number',
  'currency',
  'percentage',
  'date',
  'timestamp',
  'text',
]);

/** the input shape both search tools share */
export const prospectSearchInputSchema = z.object({
  filter: agentFilterSchema
    .nullable()
    .describe('null returns the whole population count'),
  sort: z
    .object({
      field: z.string().describe('a scalar number, date or text field key'),
      direction: z.enum(['asc', 'desc']).default('desc'),
    })
    .nullable()
    .default(null)
    .describe('order of the preview rows; default is CRD order'),
  columns: z
    .array(z.string())
    .max(EXTRA_COLUMNS_MAX)
    .default([])
    .describe('extra field keys to return on each row, up to 6'),
  limit: z.number().int().min(1).max(PROSPECT_ROWS_MAX).default(10),
  offset: z
    .number()
    .int()
    .min(0)
    .max(PROSPECT_OFFSET_MAX)
    .default(0)
    .describe('skip rows to page through a preview'),
  countOnly: z
    .boolean()
    .default(false)
    .describe('true when only the total is needed; no rows are fetched'),
  reading: z
    .string()
    .max(200)
    .optional()
    .describe(
      'one clause naming the interpretation you chose when the request was ambiguous',
    ),
});

export type ProspectSearchArgs = z.output<typeof prospectSearchInputSchema>;

export const filterErrorSchema = z.object({
  path: z.string(),
  message: z.string(),
  nearMatches: z.array(z.string()).optional(),
  example: z
    .object({
      field: z.string(),
      op: z.string(),
      value: z.unknown().optional(),
    })
    .optional(),
  hint: z.string().optional(),
});

export type ProspectRawRow = {
  sourceCrd: string;
  recordId: string | null;
  byKey: Map<string, unknown>;
};

export type ProspectSearchOutcome =
  | {
      ok: true;
      total: number;
      rows: ProspectRawRow[];
      dictionary: FieldDictionary;
      filter: AgentFilter | null;
    }
  | {
      ok: false;
      filterErrors: AgentFilterError[];
      dictionary: FieldDictionary;
    };

export const asString = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

export const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
};

/** the display label for an option value, e.g. "1b_5b" → "$1B – $5B" */
export const labelFor = (
  dictionary: FieldDictionary,
  allowKey: string,
  value: string | null,
): string | null => {
  if (value === null) return null;

  const option = dictionary
    .get(allowKey)
    ?.options.find((o) => o.value === value);

  return option?.label ?? null;
};

/**
 * Everything both search tools do before shaping rows: build the dictionary,
 * compile the filter, validate sort and extra columns against it, run the
 * query, and re-key the returned values by allow key.
 */
export const runProspectSearch = async (
  args: ProspectSearchArgs,
  sourceKind: SourceKind,
  defaultKeys: readonly string[],
  { queries, identity }: ToolContext,
): Promise<ProspectSearchOutcome> => {
  const facets = await queries.getFacets(identity, sourceKind);
  const dictionary = buildFieldDictionary(facets);
  const errors: AgentFilterError[] = [];

  const compiled = args.filter
    ? compileAgentFilter(args.filter, dictionary)
    : { ok: true as const, tree: null };

  if (!compiled.ok) errors.push(...compiled.errors);

  args.columns.forEach((key, index) => {
    if (!dictionary.has(key)) {
      errors.push({
        path: `columns[${index}]`,
        message: `unknown field "${key}"`,
      });
    }
  });

  const sort: SortAst = [];

  if (args.sort) {
    const facet = dictionary.get(args.sort.field);

    if (!facet) {
      errors.push({
        path: 'sort',
        message: `unknown field "${args.sort.field}"`,
      });
    } else if (facet.isArray || !SORTABLE_TYPES.has(facet.type)) {
      errors.push({
        path: 'sort',
        message: `${args.sort.field} cannot be sorted on; use a number, date or text field`,
      });
    } else {
      sort.push({
        path: [{ attributeId: facet.attributeId }],
        direction: args.sort.direction,
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, filterErrors: errors, dictionary };
  }

  const selectKeys = args.countOnly
    ? []
    : [...new Set([...defaultKeys, ...args.columns])];
  const selected = selectKeys.flatMap((key) => {
    const facet = dictionary.get(key);

    return facet ? [{ key, attributeId: facet.attributeId }] : [];
  });
  const keyByAttributeId = new Map(
    selected.map(({ key, attributeId }) => [attributeId, key]),
  );

  const result = await queries.searchAdvisors(identity, {
    sourceKind,
    filter: compiled.tree,
    sort,
    selectAttributeIds: selected.map(({ attributeId }) => attributeId),
    // the total rides on every row, so a count still needs one row
    limit: args.countOnly ? 1 : args.limit,
    offset: args.countOnly ? 0 : args.offset,
  });

  return {
    ok: true,
    total: result.total,
    dictionary,
    filter: args.filter,
    rows: args.countOnly
      ? []
      : result.rows.map((row) => {
          const byKey = new Map<string, unknown>();

          for (const { attributeId, value } of row.values) {
            const key = keyByAttributeId.get(attributeId);

            if (key) byKey.set(key, value);
          }

          return { sourceCrd: row.sourceCrd, recordId: row.recordId, byKey };
        }),
  };
};

/** the requested extra columns, keyed by allow key, for the row's `extra` field */
export const extrasFor = (
  row: ProspectRawRow,
  columns: readonly string[],
): Record<string, unknown> =>
  Object.fromEntries(columns.map((key) => [key, row.byKey.get(key) ?? null]));
