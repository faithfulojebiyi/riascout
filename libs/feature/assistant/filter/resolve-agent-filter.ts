import type { FilterTree } from '@feature/entities/filter-sort/ast.js';

import type { SourceKind, ToolContext } from '../tools/define-tool.js';
import type { AgentFilter } from './agent-filter.schema.js';
import {
  compileAgentFilter,
  type AgentFilterError,
} from './compile-agent-filter.js';
import {
  buildFieldDictionary,
  type FieldDictionary,
} from './field-dictionary.js';

export type ResolvedAgentFilter =
  | { ok: true; tree: FilterTree | null; dictionary: FieldDictionary }
  | {
      ok: false;
      filterErrors: AgentFilterError[];
      dictionary: FieldDictionary;
    };

/** the workspace's dictionary plus compilation, for any tool that takes an AgentFilter */
export const resolveAgentFilter = async (
  filter: AgentFilter | null,
  sourceKind: SourceKind,
  { queries, identity }: ToolContext,
): Promise<ResolvedAgentFilter> => {
  const dictionary = buildFieldDictionary(
    await queries.getFacets(identity, sourceKind),
  );

  if (!filter) return { ok: true, tree: null, dictionary };

  const compiled = compileAgentFilter(filter, dictionary);

  return compiled.ok
    ? { ok: true, tree: compiled.tree, dictionary }
    : { ok: false, filterErrors: compiled.errors, dictionary };
};
