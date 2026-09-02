import { z } from 'zod';

// response DTOs use { codec: true } so Date <-> ISO string crosses the wire correctly
export const dateToString = z.codec(z.iso.datetime(), z.date(), {
  decode: (isoString) => new Date(isoString),
  encode: (date) => date.toISOString(),
});

/**
 * bigint <-> string, same reasoning as dateToString: the wire side has to be
 * JSON-schema-representable and bigint is not, so a z.bigint() in a DTO fails
 * swagger generation at boot. Decoding hands the query layer the bigint it
 * wants, so no handler has to call BigInt() by hand.
 */
export const bigIntToString = z.codec(z.string().regex(/^\d+$/), z.bigint(), {
  decode: (digits) => BigInt(digits),
  encode: (value) => value.toString(),
});

/**
 * CRDs are bigint identities, never quantities. Positivity is enforced on the
 * wire side by the leading-digit pattern rather than a refinement, so the
 * constraint survives into the generated OpenAPI schema.
 */
export const crdSchema = z.codec(z.string().regex(/^[1-9]\d*$/), z.bigint(), {
  decode: (digits) => BigInt(digits),
  encode: (value) => value.toString(),
});
