/**
 * The allowlist names the postgres column; prisma exposes it camelCased. The
 * grid never needs this — it selects the snake_case column in raw SQL — but a
 * record read goes through the prisma client, so it does.
 *
 * `_(.)` rather than `_([a-z])`: a digit after the underscore must upper-case
 * the run too, so aum_cagr_1y is aumCagr1y and not aumCagr_1y.
 */
export const referenceProperty = (column: string): string =>
  column.replace(/_(.)/g, (_, c: string) => c.toUpperCase());
