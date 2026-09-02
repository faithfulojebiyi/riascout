/**
 * numeric(20,2) exceeds Number.MAX_SAFE_INTEGER at cent precision, so money
 * leaves the API as a decimal string. null is preserved rather than coerced —
 * an unreported measure is unknown, not zero.
 */
export const toMoney = (value: { toString: () => string } | null): string | null =>
  value === null ? null : value.toString();

/**
 * Counts arrive from TypedSQL as bigint and from the projection as int; JSON has
 * no bigint. null is preserved — a count is 0 only when the filing affirmatively
 * reported none.
 */
export const toCount = (value: bigint | number | null): number | null =>
  value === null ? null : Number(value);
