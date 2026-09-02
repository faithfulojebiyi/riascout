import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { bigIntToString, crdSchema, dateToString } from './utils.js';

/**
 * These codecs exist because JSON Schema cannot represent bigint or Date, and a
 * DTO carrying either fails swagger generation at boot rather than at compile
 * time. That failure mode is invisible to typecheck, so it is pinned here.
 */
describe('boundary codecs', () => {
  it('decodes a crd string to bigint for the query layer', () => {
    expect(z.decode(crdSchema, '167174')).toBe(167174n);
  });

  it('encodes bigint back to a string on the way out', () => {
    expect(z.encode(crdSchema, 167174n)).toBe('167174');
  });

  it('survives a crd beyond the safe integer range', () => {
    const huge = '9007199254740993';

    expect(z.decode(crdSchema, huge)).toBe(9007199254740993n);
    expect(z.encode(crdSchema, 9007199254740993n)).toBe(huge);
  });

  it('rejects a non-positive or non-numeric crd', () => {
    expect(() => z.decode(crdSchema, '0')).toThrow('Invalid string');
    expect(() => z.decode(crdSchema, '-1')).toThrow('Invalid string');
    expect(() => z.decode(crdSchema, '12.5')).toThrow('Invalid string');
  });

  it('allows zero on the general bigint codec, unlike a crd', () => {
    expect(z.decode(bigIntToString, '0')).toBe(0n);
  });

  /** the wire side is what swagger reads, so it must be a plain json type */
  it.each([
    ['crdSchema', crdSchema, 'string'],
    ['bigIntToString', bigIntToString, 'string'],
    ['dateToString', dateToString, 'string'],
  ])('%s presents a json-representable wire type', (_name, codec, expected) => {
    expect(z.toJSONSchema(codec, { io: 'input' }).type).toBe(expected);
  });
});
