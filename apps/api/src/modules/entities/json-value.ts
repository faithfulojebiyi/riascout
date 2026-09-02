/**
 * CRDs are bigint in postgres and JSON has no bigint. They are identifiers
 * rather than quantities, so they cross the boundary as strings — a number
 * would silently lose precision above 2^53 and invite arithmetic besides.
 */
export const toJsonValue = (value: unknown): unknown => {
  if (typeof value === 'bigint') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(toJsonValue);
  }

  return value;
};
