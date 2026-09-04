import type { MastraMessagePart } from '@mastra/react';
import type { ComponentType } from 'react';

export type ToolInvocationPart = Extract<
  MastraMessagePart,
  { type: 'tool-invocation' }
>;

export type ApprovalDescription = {
  title: string;
  /** what will happen, in the recruiter's words; one line each */
  lines: string[];
};

/**
 * One renderer per tool name. Result renders a landed result; detail is the
 * short suffix on the status row; describeApproval turns the tool input into
 * the approval card's text so no extra model call is needed.
 */
export type ToolRenderer = {
  Result?: ComponentType<{
    result: unknown;
    input: unknown;
    toolCallId: string;
  }>;
  detail?: (result: unknown) => string | null;
  describeApproval?: (input: unknown) => ApprovalDescription;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const money = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return 'not reported';

  const amount = Number(value);

  if (!Number.isFinite(amount)) return String(value);
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${Math.round(amount / 1e6)}M`;

  return `$${Math.round(amount).toLocaleString()}`;
};
