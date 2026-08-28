import type { AttributeRelationshipType, AttributeType } from '@orm/app';

export type AttributeMeta = {
  id: string;
  entityId: string;
  type: AttributeType;
  isMultiValue: boolean;
  relationshipType: AttributeRelationshipType | null;
  /** which side of a relationship pair owns the canonical edge row */
  isCanonicalSide: boolean | null;
  otherRelationshipSideAttributeId: string | null;
  /** set for reference attributes; resolved against the allowlist, never trusted raw */
  referenceColumn: string | null;
};

export type EdgeDispatch = {
  attrId: string | null;
  sourceCol: 'source_record_id' | 'target_record_id';
  targetCol: 'source_record_id' | 'target_record_id';
};

/**
 * Edges are stored once, on the canonical side. Reading from the non-canonical
 * side flips the columns and dispatches to the paired attribute id.
 */
export const relDispatch = (attr: AttributeMeta): EdgeDispatch => {
  if (attr.isCanonicalSide !== false) {
    return { attrId: attr.id, sourceCol: 'source_record_id', targetCol: 'target_record_id' };
  }

  return {
    attrId: attr.otherRelationshipSideAttributeId,
    sourceCol: 'target_record_id',
    targetCol: 'source_record_id',
  };
};
