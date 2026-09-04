/**
 * The assistant's filter language, mirrored from libs/feature/assistant. The
 * dashboard cannot import libs, so the shape is checked here by hand; anything
 * that does not fit is dropped rather than guessed at.
 */
export type AgentCondition = { field: string; op: string; value?: unknown };

export type AgentFilter = {
  all: AgentCondition[];
  any: AgentCondition[];
  none: AgentCondition[];
};

export const AGENT_FILTER_PARAM = 'f';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toConditions = (value: unknown): AgentCondition[] | null => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;

  const conditions: AgentCondition[] = [];

  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.field !== 'string' ||
      typeof item.op !== 'string'
    ) {
      return null;
    }

    conditions.push({ field: item.field, op: item.op, value: item.value });
  }

  return conditions;
};

export const parseAgentFilter = (value: unknown): AgentFilter | null => {
  if (!isRecord(value)) return null;

  const all = toConditions(value.all);
  const any = toConditions(value.any);
  const none = toConditions(value.none);

  return all && any && none ? { all, any, none } : null;
};

const fromBase64Url = (token: string): string => {
  const base64 = token.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));

  return new TextDecoder().decode(bytes);
};

const toBase64Url = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';

  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
};

export const decodeAgentFilter = (token: string): AgentFilter | null => {
  try {
    return parseAgentFilter(JSON.parse(fromBase64Url(token)));
  } catch {
    return null;
  }
};

export const encodeAgentFilter = (filter: AgentFilter): string =>
  toBase64Url(JSON.stringify(filter));
