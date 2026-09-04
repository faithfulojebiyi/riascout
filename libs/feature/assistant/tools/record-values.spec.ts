import { describe, expect, it } from 'vitest';

import type { EditableAttribute } from './define-tool.js';
import { coerceRecordValue, findAttribute } from './record-values.js';

const attr = (partial: Partial<EditableAttribute>): EditableAttribute => ({
  id: 'a',
  key: 'status',
  label: 'Status',
  type: 'status',
  isMultiValue: false,
  choices: [],
  ...partial,
});

describe('coerceRecordValue', () => {
  it('matches a choice by name regardless of case and rejects unknown names', () => {
    const status = attr({ choices: ['New', 'Contacted', 'Qualified'] });

    expect(coerceRecordValue(status, 'qualified')).toEqual({
      ok: true,
      value: 'Qualified',
    });
    expect(coerceRecordValue(status, 'Won')).toMatchObject({
      ok: false,
      message: expect.stringContaining('New, Contacted, Qualified'),
    });
  });

  it('reads yes/no words as booleans', () => {
    const flag = attr({
      type: 'checkbox',
      key: 'dnc',
      label: 'Do not contact',
    });

    expect(coerceRecordValue(flag, 'yes')).toEqual({ ok: true, value: true });
    expect(coerceRecordValue(flag, 'No')).toEqual({ ok: true, value: false });
    expect(coerceRecordValue(flag, 'maybe').ok).toBe(false);
  });

  it('normalises dates to a day and numbers to numbers', () => {
    const date = attr({
      type: 'date',
      key: 'last_contacted',
      label: 'Last Contacted',
    });
    const num = attr({ type: 'currency', key: 'book', label: 'Book' });

    expect(coerceRecordValue(date, '2026-09-04T10:00:00Z')).toEqual({
      ok: true,
      value: '2026-09-04',
    });
    expect(coerceRecordValue(num, '$1,500,000')).toEqual({
      ok: true,
      value: 1_500_000,
    });
    expect(coerceRecordValue(date, 'next tuesday').ok).toBe(false);
  });

  it('treats empty input as clearing the cell', () => {
    expect(coerceRecordValue(attr({ type: 'text' }), '')).toEqual({
      ok: true,
      value: null,
    });
  });
});

describe('findAttribute', () => {
  it('resolves by key first, then by label, case-insensitively', () => {
    const attributes = [
      attr({ id: '1', key: 'status', label: 'Pipeline' }),
      attr({ id: '2', key: 'notes', label: 'Notes', type: 'text' }),
    ];

    expect(findAttribute(attributes, 'STATUS')?.id).toBe('1');
    expect(findAttribute(attributes, 'pipeline')?.id).toBe('1');
    expect(findAttribute(attributes, 'Notes')?.id).toBe('2');
    expect(findAttribute(attributes, 'owner')).toBeUndefined();
  });
});
