import type { EditableAttribute } from './define-tool.js';

export type CoercedValue =
  { ok: true; value: unknown } | { ok: false; message: string };

const TRUE_WORDS = new Set(['true', 'yes', 'y', '1', 'on', 'done']);
const FALSE_WORDS = new Set(['false', 'no', 'n', '0', 'off']);

const asText = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value).trim();

/**
 * Turns what the model sends into what the cell writer stores for the
 * attribute's type. Choices are matched by name because that is what the
 * grid writes; a miss lists the names so the model can correct itself.
 */
export const coerceRecordValue = (
  attribute: EditableAttribute,
  raw: unknown,
): CoercedValue => {
  if (raw === null || raw === undefined || raw === '') {
    return { ok: true, value: null };
  }

  if (attribute.isMultiValue) {
    const list = Array.isArray(raw) ? raw : [raw];

    return { ok: true, value: list.map((v) => String(v)) };
  }

  switch (attribute.type) {
    case 'status':
    case 'select': {
      const wanted = String(raw).trim().toLowerCase();
      const match = attribute.choices.find(
        (choice) => choice.toLowerCase() === wanted,
      );

      return match
        ? { ok: true, value: match }
        : {
            ok: false,
            message: `${attribute.label} must be one of: ${attribute.choices.join(', ')}`,
          };
    }
    case 'boolean':
    case 'checkbox': {
      if (typeof raw === 'boolean') return { ok: true, value: raw };

      const word = String(raw).trim().toLowerCase();

      if (TRUE_WORDS.has(word)) return { ok: true, value: true };
      if (FALSE_WORDS.has(word)) return { ok: true, value: false };

      return { ok: false, message: `${attribute.label} must be yes or no` };
    }
    case 'number':
    case 'currency':
    case 'percentage':
    case 'rating': {
      const parsed =
        typeof raw === 'number'
          ? raw
          : Number(String(raw).replace(/[$,%\s_]/g, ''));

      return Number.isFinite(parsed)
        ? { ok: true, value: parsed }
        : { ok: false, message: `${attribute.label} must be a number` };
    }
    case 'date':
    case 'timestamp': {
      const text = asText(raw) ?? '';
      const parsed = new Date(text);

      if (Number.isNaN(parsed.getTime())) {
        return {
          ok: false,
          message: `${attribute.label} must be a date such as 2026-09-04`,
        };
      }

      return {
        ok: true,
        value:
          attribute.type === 'date'
            ? parsed.toISOString().slice(0, 10)
            : parsed.toISOString(),
      };
    }
    case 'email': {
      const text = asText(raw) ?? '';

      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)
        ? { ok: true, value: text }
        : { ok: false, message: `${attribute.label} must be an email address` };
    }
    case 'url':
    case 'domain': {
      const text = asText(raw) ?? '';

      return text.includes('.')
        ? { ok: true, value: text }
        : { ok: false, message: `${attribute.label} must be a web address` };
    }
    default:
      return { ok: true, value: asText(raw) };
  }
};

/** the same attribute whether the model says "status", "Status" or "pipeline status" */
export const findAttribute = (
  attributes: readonly EditableAttribute[],
  field: string,
): EditableAttribute | undefined => {
  const wanted = field.trim().toLowerCase();

  return (
    attributes.find((a) => a.key.toLowerCase() === wanted) ??
    attributes.find((a) => a.label.toLowerCase() === wanted)
  );
};
