import { z } from 'zod';

// response DTOs use { codec: true } so Date <-> ISO string crosses the wire correctly
export const dateToString = z.codec(z.iso.datetime(), z.date(), {
  decode: (isoString) => new Date(isoString),
  encode: (date) => date.toISOString(),
});

// CRDs are numeric and arrive as strings over HTTP
export const crdSchema = z.coerce.bigint().positive();
