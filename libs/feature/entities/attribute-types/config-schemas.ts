import { z } from 'zod';

import type { AttributeType } from '@orm/app';

import { resolveReferenceColumn } from './reference-columns.js';

/**
 * Per-type config for EntityAttribute.config. Every schema is strict: an
 * unrecognised key is a typo that would otherwise be stored and silently
 * ignored forever. Choices live in entity_attribute_choice, never here.
 */
const bounds = { min: z.number().optional(), max: z.number().optional() };
const precision = z.number().int().min(0).max(10).optional();

const TextConfigSchema = z.strictObject({
  maxLength: z.number().int().positive().optional(),
});
const NumberConfigSchema = z.strictObject({ precision, ...bounds });
const CurrencyConfigSchema = z.strictObject({
  precision,
  /** ISO 4217; AUM is reported in USD but a firm may report otherwise */
  currencyCode: z.string().length(3).default('USD'),
  ...bounds,
});
const RatingConfigSchema = z.strictObject({
  max: z.union([z.literal(3), z.literal(5), z.literal(10)]).default(5),
});
const DateConfigSchema = z.strictObject({
  includeTime: z.boolean().default(false),
});
const SelectConfigSchema = z.strictObject({
  allowMultiple: z.boolean().default(false),
  defaultChoiceId: z.uuid().optional(),
});
const FileConfigSchema = z.strictObject({
  maxSizeMb: z.number().positive().max(100).optional(),
  allowedMimeTypes: z.array(z.string()).optional(),
});
const EmptyConfigSchema = z.strictObject({});

const BY_TYPE: Record<AttributeType, z.ZodType> = {
  text: TextConfigSchema,
  email: TextConfigSchema,
  phone: TextConfigSchema,
  url: TextConfigSchema,
  domain: TextConfigSchema,
  location: TextConfigSchema,
  country: TextConfigSchema,

  number: NumberConfigSchema,
  currency: CurrencyConfigSchema,
  percentage: NumberConfigSchema,
  rating: RatingConfigSchema,

  date: DateConfigSchema,
  timestamp: DateConfigSchema,

  boolean: EmptyConfigSchema,
  checkbox: EmptyConfigSchema,

  status: SelectConfigSchema,
  select: SelectConfigSchema,
  user: EmptyConfigSchema,
  record: EmptyConfigSchema,

  file: FileConfigSchema,
  relationship: EmptyConfigSchema,
};

export const AttributeConfigSchema = z
  .looseObject({})
  .meta({ id: 'AttributeConfig' });

export type AttributeConfig = z.infer<typeof AttributeConfigSchema>;

/** throws ZodError on mismatch; the caller maps that to a 400 */
export const parseAttributeConfig = (
  type: AttributeType,
  raw: unknown,
): unknown => (BY_TYPE[type] ?? EmptyConfigSchema).parse(raw ?? {});

export type AttributeDefinition = {
  type: AttributeType;
  isMultiValue: boolean;
  referenceColumn: string | null;
  relationshipType: string | null;
  isCanonicalSide: boolean | null;
  otherRelationshipSideAttributeId: string | null;
  isEditable: boolean;
  config: unknown;
};

export class AttributeDefinitionError extends Error {
  readonly code = 'INVALID_ATTRIBUTE_DEFINITION';

  constructor(message: string) {
    super(message);
    this.name = 'AttributeDefinitionError';
  }
}

/**
 * Cross-field rules the column types cannot express. These matter because a
 * malformed attribute is not rejected by the compiler — it is silently dropped
 * from every filter, which looks like "no results" rather than an error.
 */
export const validateAttributeDefinition = (
  def: AttributeDefinition,
): unknown => {
  if (def.referenceColumn !== null) {
    if (!resolveReferenceColumn(def.referenceColumn)) {
      throw new AttributeDefinitionError(
        `referenceColumn "${def.referenceColumn}" is not in the allowlist`,
      );
    }

    if (def.isEditable) {
      throw new AttributeDefinitionError(
        'a reference attribute is projected and cannot be editable',
      );
    }

    if (def.relationshipType !== null) {
      throw new AttributeDefinitionError(
        'an attribute cannot be both a reference and a relationship',
      );
    }
  }

  if (def.type === 'relationship') {
    if (def.relationshipType === null) {
      throw new AttributeDefinitionError(
        'a relationship attribute needs a relationshipType',
      );
    }

    // a non-canonical side with no pair makes its edges unreadable
    if (
      def.isCanonicalSide === false &&
      !def.otherRelationshipSideAttributeId
    ) {
      throw new AttributeDefinitionError(
        'a non-canonical relationship needs its paired side',
      );
    }
  } else if (def.relationshipType !== null) {
    throw new AttributeDefinitionError(
      `relationshipType is only valid on a relationship attribute, not ${def.type}`,
    );
  }

  return parseAttributeConfig(def.type, def.config);
};
