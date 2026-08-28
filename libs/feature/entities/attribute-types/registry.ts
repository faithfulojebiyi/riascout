import type { AttributeType } from '@orm/app';

/**
 * Which typed column on entity_record_value holds a given attribute type.
 * The per-type composite indexes [attribute_id, <column>] are what make EAV
 * filtering fast, so this mapping is load-bearing.
 */
export type StorageColumn =
  | 'text_value'
  | 'numeric_value'
  | 'date_value'
  | 'boolean_value'
  | 'json_value'
  | 'none';

const BY_TYPE: Record<AttributeType, StorageColumn> = {
  text: 'text_value',
  email: 'text_value',
  phone: 'text_value',
  url: 'text_value',
  domain: 'text_value',
  location: 'text_value',
  country: 'text_value',
  status: 'text_value',
  select: 'text_value',
  user: 'text_value',
  record: 'text_value',

  number: 'numeric_value',
  currency: 'numeric_value',
  percentage: 'numeric_value',
  rating: 'numeric_value',

  date: 'date_value',
  timestamp: 'date_value',

  boolean: 'boolean_value',
  checkbox: 'boolean_value',

  file: 'json_value',

  // edges live in entity_record_relationship, not in a cell
  relationship: 'none',
};

export const attributeTypeRegistry = {
  /** multi-value attributes store an array in jsonb regardless of base type */
  effectiveStorageColumn(type: AttributeType, isMultiValue: boolean): StorageColumn {
    const base = BY_TYPE[type];

    if (base === 'none') {
      return 'none';
    }

    return isMultiValue ? 'json_value' : base;
  },
};
