import { mkdirSync, writeFileSync } from 'node:fs';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  GOLDEN_CASES,
  type GoldenCase,
  type GoldenKind,
} from '@feature/assistant/evals/golden-prompts.js';
import type { AgentFilter } from '@feature/assistant/filter/agent-filter.schema.js';

type ToolCall = { toolName: string; args: Record<string, unknown> };
type Turn = { toolCalls: ToolCall[]; text: string };
type CaseResult = {
  id: string;
  kind: GoldenKind;
  score: number;
  note: string;
  toolCalls: ToolCall[];
  text: string;
};

const SEARCH_TOOLS = new Set(['search_advisers', 'search_firms']);

type Canonical = { field: string; op: string; value?: unknown; group: string };

/**
 * Equivalent spellings score the same: `is X` is `isAnyOf [X]`, `isNot X` is
 * `isNoneOf [X]`, and a condition in `none` is its negation in `all`. The
 * compiler treats them identically, so the scorer must too.
 */
const canonical = (
  c: { field: string; op: string; value?: unknown },
  group: string,
): Canonical => {
  let { op, value } = c;

  if (op === 'is' && !Array.isArray(value) && typeof value !== 'boolean') {
    op = 'isAnyOf';
    value = [value];
  } else if (op === 'isNot' && !Array.isArray(value)) {
    op = 'isNoneOf';
    value = [value];
  }

  if (group === 'none' && op === 'is' && typeof value === 'boolean') {
    return { ...c, op: 'is', value: !value, group: 'all' };
  }

  if (group === 'none' && op === 'isAnyOf')
    return { ...c, op: 'isNoneOf', value, group: 'all' };
  if (group === 'none' && op === 'isNoneOf')
    return { ...c, op: 'isAnyOf', value, group: 'all' };

  return { ...c, op, value, group };
};

// the model omits empty groups; the server's zod defaults never reach the stream
const conditionsOf = (filter: Partial<AgentFilter>): Canonical[] => [
  ...(filter.all ?? []).map((c) => canonical(c, 'all')),
  ...(filter.any ?? []).map((c) => canonical(c, 'any')),
  ...(filter.none ?? []).map((c) => canonical(c, 'none')),
];

const sameValue = (expected: unknown, actual: unknown): boolean => {
  // "six months" is 180 or 183 days; a day-count within 5% is the same reading
  if (typeof expected === 'number' && typeof actual === 'number') {
    return Math.abs(expected - actual) <= Math.abs(expected) * 0.05;
  }

  const norm = (v: unknown): string =>
    JSON.stringify(
      Array.isArray(v)
        ? [...v].map((x) => String(x)).sort()
        : typeof v === 'number'
          ? v
          : String(v ?? ''),
    );

  return norm(expected) === norm(actual);
};

/**
 * Field-set Jaccard, then operator and value exactness on the overlap. A
 * missing search call scores zero; a call on the wrong entity scores zero.
 */
const scoreFilterCase = (
  goldenCase: GoldenCase & {
    expect: { filter: AgentFilter; countOnly?: boolean };
  },
  turn: Turn,
): { score: number; note: string } => {
  const expectedTool =
    goldenCase.sourceKind === 'firm' ? 'search_firms' : 'search_advisers';
  const call = turn.toolCalls.find((c) => SEARCH_TOOLS.has(c.toolName));

  if (!call) return { score: 0, note: 'no search call' };
  if (call.toolName !== expectedTool) {
    return { score: 0, note: `searched ${call.toolName}` };
  }

  const actualFilter = call.args.filter as
    Partial<AgentFilter> | null | undefined;
  const actual = actualFilter ? conditionsOf(actualFilter) : [];
  const expected = conditionsOf(goldenCase.expect.filter);
  const expectedFields = new Set(expected.map((c) => c.field));
  const actualFields = new Set(actual.map((c) => c.field));
  const overlap = [...expectedFields].filter((f) => actualFields.has(f));
  const union = new Set([...expectedFields, ...actualFields]);
  const jaccard = union.size === 0 ? 1 : overlap.length / union.size;

  let exact = 0;

  for (const field of overlap) {
    const want = expected.filter((c) => c.field === field);
    const got = actual.filter((c) => c.field === field);
    const matched = want.every((w) =>
      got.some(
        (g) =>
          g.op === w.op && g.group === w.group && sameValue(w.value, g.value),
      ),
    );

    if (matched) exact += 1;
  }

  const exactness = overlap.length === 0 ? 0 : exact / overlap.length;
  const countOnlyOk =
    goldenCase.expect.countOnly === undefined ||
    Boolean(call.args.countOnly) === goldenCase.expect.countOnly;
  const score = (jaccard * 0.5 + exactness * 0.5) * (countOnlyOk ? 1 : 0.8);
  const missing = [...expectedFields].filter((f) => !actualFields.has(f));
  const extra = [...actualFields].filter((f) => !expectedFields.has(f));

  return {
    score: Number(score.toFixed(2)),
    note: [
      missing.length ? `missing ${missing.join(',')}` : '',
      extra.length ? `extra ${extra.join(',')}` : '',
      exactness < 1 ? `ops/values ${exact}/${overlap.length}` : '',
      countOnlyOk ? '' : 'countOnly wrong',
    ]
      .filter(Boolean)
      .join('; '),
  };
};

/**
 * Null probes pass when the answer names the caveat. Searching is not a
 * failure in itself: the prompt allows the literal reading when it is stated.
 */
const scoreNullCase = (
  goldenCase: GoldenCase,
  turn: Turn,
): { score: number; note: string } => {
  const searched = turn.toolCalls.some((c) => SEARCH_TOOLS.has(c.toolName));
  const mentions =
    'unavailable' in goldenCase.expect
      ? (goldenCase.expect.mentions ?? [goldenCase.expect.unavailable])
      : 'clarify' in goldenCase.expect
        ? goldenCase.expect.mentions
        : [];
  const text = turn.text.toLowerCase();
  const named = mentions.some((term) => text.includes(term.toLowerCase()));
  const asked = turn.text.includes('?');

  if (named) return { score: 1, note: '' };
  if (!searched && asked)
    return { score: 0.75, note: 'asked without naming the caveat' };
  if (!searched)
    return { score: 0.5, note: `did not name ${mentions.join('/')}` };

  return { score: 0, note: 'searched and named no caveat' };
};

describe.skipIf(!process.env.SPIKE_LLM)(
  'assistant golden eval (SPIKE_LLM=1)',
  () => {
    const base = `http://localhost:${process.env.PORT ?? 3320}`;
    const agentId = 'assistant';
    const only = process.env.EVAL_KIND as GoldenKind | undefined;
    const onlyId = process.env.EVAL_ID;
    const cases = GOLDEN_CASES.filter(
      (c) => (!only || c.kind === only) && (!onlyId || c.id === onlyId),
    );
    const results: CaseResult[] = [];
    const threadIds: string[] = [];
    let cookie = '';

    const agentFetch = (path: string, init: RequestInit = {}) =>
      fetch(`${base}/agent${path}`, {
        ...init,
        headers: {
          'content-type': 'application/json',
          cookie,
          ...init.headers,
        },
      });

    const runTurn = async (prompt: string): Promise<Turn> => {
      const threadId = crypto.randomUUID();

      threadIds.push(threadId);

      const response = await agentFetch(`/agents/${agentId}/stream`, {
        method: 'POST',
        body: JSON.stringify({
          messages: prompt,
          memory: { thread: threadId },
        }),
      });

      expect(response.status).toBe(200);

      const raw = await response.text();
      const turn: Turn = { toolCalls: [], text: '' };

      for (const line of raw.split('\n')) {
        const json = line.startsWith('data:')
          ? line.slice(5).trim()
          : line.trim();

        if (!json.startsWith('{')) continue;

        let chunk: { type?: string; payload?: Record<string, unknown> };

        try {
          chunk = JSON.parse(json) as typeof chunk;
        } catch {
          continue;
        }

        const payload = chunk.payload ?? {};

        if (chunk.type === 'tool-call') {
          turn.toolCalls.push({
            toolName: String(payload.toolName ?? ''),
            args: (payload.args ?? payload.input ?? {}) as Record<
              string,
              unknown
            >,
          });
        } else if (chunk.type === 'text-delta') {
          turn.text += String(payload.text ?? '');
        }
      }

      return turn;
    };

    beforeAll(async () => {
      const response = await fetch(`${base}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: base },
        body: JSON.stringify({
          email: `assistant-eval-${Date.now()}@example.test`,
          password: 'correct-horse-battery-staple',
          name: 'Eval',
        }),
      });

      if (response.status !== 200) {
        throw new Error(`sign-up failed with ${response.status}`);
      }

      cookie = response.headers.get('set-cookie') ?? '';
    });

    afterAll(async () => {
      for (const threadId of threadIds) {
        await agentFetch(`/memory/threads/${threadId}?agentId=${agentId}`, {
          method: 'DELETE',
        }).catch(() => undefined);
      }

      const byKind = new Map<GoldenKind, number[]>();

      for (const result of results) {
        byKind.set(result.kind, [
          ...(byKind.get(result.kind) ?? []),
          result.score,
        ]);
      }

      console.table(
        [...byKind.entries()].map(([kind, scores]) => ({
          kind,
          cases: scores.length,
          mean: Number(
            (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2),
          ),
          perfect: scores.filter((s) => s === 1).length,
        })),
      );
      console.table(
        results
          .filter((r) => r.score < 1)
          .map(({ id, score, note }) => ({ id, score, note })),
      );

      mkdirSync('storage/evals', { recursive: true });
      writeFileSync(
        `storage/evals/${new Date().toISOString().replaceAll(':', '-')}.json`,
        JSON.stringify(results, null, 2),
      );
    });

    for (const goldenCase of cases) {
      it(`${goldenCase.id}: ${goldenCase.prompt}`, async () => {
        const turn = await runTurn(goldenCase.prompt);
        const scored =
          'filter' in goldenCase.expect
            ? scoreFilterCase(
                goldenCase as GoldenCase & {
                  expect: { filter: AgentFilter; countOnly?: boolean };
                },
                turn,
              )
            : scoreNullCase(goldenCase, turn);

        results.push({
          id: goldenCase.id,
          kind: goldenCase.kind,
          ...scored,
          toolCalls: turn.toolCalls,
          text: turn.text,
        });

        // the run is a report, not a gate: a bad case shows in the table
        expect(turn).toBeDefined();
      }, 120_000);
    }
  },
);
