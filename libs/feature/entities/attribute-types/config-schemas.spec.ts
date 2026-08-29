import { describe, expect, it } from 'vitest';

import {
  AttributeDefinitionError,
  parseAttributeConfig,
  validateAttributeDefinition,
  type AttributeDefinition,
} from './config-schemas.js';

const def = (over: Partial<AttributeDefinition> = {}): AttributeDefinition => ({
  type: 'text',
  isMultiValue: false,
  referenceColumn: null,
  relationshipType: null,
  isCanonicalSide: null,
  otherRelationshipSideAttributeId: null,
  isEditable: true,
  config: {},
  ...over,
});

describe('attribute config', () => {
  describe('per-type parsing', () => {
    it('defaults an empty config rather than rejecting it', () => {
      expect(parseAttributeConfig('text', {})).toEqual({});
    });

    it('treats a null config as empty', () => {
      expect(parseAttributeConfig('text', null)).toEqual({});
    });

    it('applies declared defaults', () => {
      expect(parseAttributeConfig('currency', {})).toEqual({
        currencyCode: 'USD',
      });
      expect(parseAttributeConfig('rating', {})).toEqual({ max: 5 });
      expect(parseAttributeConfig('date', {})).toEqual({ includeTime: false });
    });

    it('rejects an unknown key instead of silently storing it', () => {
      expect(() => parseAttributeConfig('number', { precison: 2 })).toThrow();
    });

    it('rejects a value outside its declared range', () => {
      expect(() => parseAttributeConfig('number', { precision: 99 })).toThrow();
      expect(() => parseAttributeConfig('rating', { max: 7 })).toThrow();
      expect(() =>
        parseAttributeConfig('currency', { currencyCode: 'DOLLAR' }),
      ).toThrow();
    });

    it('accepts a valid numeric config', () => {
      expect(
        parseAttributeConfig('number', { precision: 2, min: 0, max: 100 }),
      ).toEqual({
        precision: 2,
        min: 0,
        max: 100,
      });
    });

    it('keeps choices out of config — they live in entity_attribute_choice', () => {
      expect(() =>
        parseAttributeConfig('select', { choices: ['A', 'B'] }),
      ).toThrow();
    });

    it('allows select to declare multi-select and a default', () => {
      expect(
        parseAttributeConfig('select', {
          allowMultiple: true,
          defaultChoiceId: '11111111-1111-4111-8111-111111111111',
        }),
      ).toEqual({
        allowMultiple: true,
        defaultChoiceId: '11111111-1111-4111-8111-111111111111',
      });
    });

    it('gives relationship attributes no config surface', () => {
      expect(() =>
        parseAttributeConfig('relationship', { relationshipType: 'manyToOne' }),
      ).toThrow();
    });
  });

  describe('reference attributes', () => {
    it('accepts an allowlisted column', () => {
      expect(() =>
        validateAttributeDefinition(
          def({
            type: 'number',
            referenceColumn: 'advisor.tenure_months',
            isEditable: false,
          }),
        ),
      ).not.toThrow();
    });

    it('rejects a column outside the allowlist', () => {
      expect(() =>
        validateAttributeDefinition(
          def({ referenceColumn: 'advisor.secret_column', isEditable: false }),
        ),
      ).toThrow(AttributeDefinitionError);
    });

    it('rejects an editable reference attribute', () => {
      expect(() =>
        validateAttributeDefinition(
          def({ referenceColumn: 'advisor.tenure_months', isEditable: true }),
        ),
      ).toThrow(/cannot be editable/);
    });

    it('rejects an attribute that is both reference and relationship', () => {
      expect(() =>
        validateAttributeDefinition(
          def({
            referenceColumn: 'advisor.tenure_months',
            isEditable: false,
            relationshipType: 'manyToOne',
          }),
        ),
      ).toThrow(/both a reference and a relationship/);
    });
  });

  describe('relationship attributes', () => {
    it('requires a relationshipType', () => {
      expect(() =>
        validateAttributeDefinition(def({ type: 'relationship' })),
      ).toThrow(/needs a relationshipType/);
    });

    it('requires a paired side when non-canonical', () => {
      expect(() =>
        validateAttributeDefinition(
          def({
            type: 'relationship',
            relationshipType: 'oneToMany',
            isCanonicalSide: false,
          }),
        ),
      ).toThrow(/needs its paired side/);
    });

    it('accepts a canonical relationship with no pair', () => {
      expect(() =>
        validateAttributeDefinition(
          def({
            type: 'relationship',
            relationshipType: 'manyToOne',
            isCanonicalSide: true,
          }),
        ),
      ).not.toThrow();
    });

    it('rejects a relationshipType on a non-relationship attribute', () => {
      expect(() =>
        validateAttributeDefinition(
          def({ type: 'text', relationshipType: 'manyToOne' }),
        ),
      ).toThrow(/only valid on a relationship/);
    });
  });

  it('returns the parsed config so the caller stores the normalised value', () => {
    expect(
      validateAttributeDefinition(def({ type: 'currency', config: {} })),
    ).toEqual({
      currencyCode: 'USD',
    });
  });
});
