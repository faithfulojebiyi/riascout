import type { AgentFilter } from './agent-filter.schema.js';

/** browsers and proxies are reliable up to about here */
export const OPEN_URL_MAX = 2000;

export const AGENT_FILTER_PARAM = 'f';

/** the filter, by field key, as a URL-safe token the dashboard decodes */
export const encodeAgentFilter = (filter: AgentFilter): string =>
  Buffer.from(JSON.stringify(filter), 'utf8').toString('base64url');

export const decodeAgentFilter = (token: string): unknown => {
  try {
    return JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

/**
 * The prospecting page with the filter pre-applied, or the bare page when the
 * filter would not fit in a URL. A bare page still lands the recruiter in the
 * right place; a truncated token would silently show the wrong population.
 */
export const openUrlFor = (
  path: string,
  filter: AgentFilter | null,
): { openUrl: string; openUrlCarriesFilter: boolean } => {
  if (!filter) return { openUrl: path, openUrlCarriesFilter: false };

  const url = `${path}?${AGENT_FILTER_PARAM}=${encodeAgentFilter(filter)}`;

  return url.length <= OPEN_URL_MAX
    ? { openUrl: url, openUrlCarriesFilter: true }
    : { openUrl: path, openUrlCarriesFilter: false };
};
