import type {
  GetEntityRecordResponse,
  RecordAttribute,
} from '../../api/generated/rIAScoutAPI.schemas';

/** the attribute carrying the record's display name, per entity kind */
const NAME_COLUMNS = ['firm.firm_name', 'advisor.full_name'];

export type RecordValue = {
  attribute: RecordAttribute;
  value: unknown;
  /** a market value is read-only and carries no version to edit against */
  isProjected: boolean;
};

/**
 * Joins the parallel attribute and cell arrays. An attribute with no cell keeps
 * a value of null, which the renderers show as an em-dash — the record simply
 * has nothing for it, which is not the same as a zero.
 */
export const valuesByAttribute = (
  record: GetEntityRecordResponse,
): RecordValue[] => {
  const cells = new Map(record.cells.map((c) => [c.attributeId, c]));

  return record.attributes.map((attribute) => {
    const cell = cells.get(attribute.attributeId);

    return {
      attribute,
      value: cell?.value ?? null,
      isProjected: cell?.source === 'market',
    };
  });
};

export const valueOf = (
  record: GetEntityRecordResponse,
  referenceColumn: string,
): unknown => {
  const attribute = record.attributes.find(
    (a) => a.referenceColumn === referenceColumn,
  );

  if (!attribute) {
    return null;
  }

  return (
    record.cells.find((c) => c.attributeId === attribute.attributeId)?.value ??
    null
  );
};

/** falls back to the CRD rather than inventing a placeholder name */
export const recordTitle = (record: GetEntityRecordResponse): string => {
  for (const column of NAME_COLUMNS) {
    const value = valueOf(record, column);

    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }

  const primary = record.attributes.find((a) => a.isPrimary);
  const value = primary
    ? record.cells.find((c) => c.attributeId === primary.attributeId)?.value
    : null;

  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }

  return record.market.sourceCrd
    ? `CRD #${record.market.sourceCrd}`
    : 'Untitled record';
};

/**
 * "Registered Investment Adviser | CRD #167174". Each half is dropped when its
 * source is missing rather than shown as unknown — a subtitle is a label, and a
 * record with neither simply has none.
 */
export const recordSubtitle = (
  record: GetEntityRecordResponse,
): string | null => {
  const parts: string[] = [];
  /**
   * A firm's registration type; an adviser's current firm. Both answer "what am
   * I looking at", but reading the firm key on an adviser would print nothing
   * and leave a bare CRD.
   */
  const lead =
    record.market.sourceKind === 'advisor'
      ? valueOf(record, 'advisor.current_firm_name')
      : valueOf(record, 'firm.primary_registration_type');

  if (typeof lead === 'string' && lead.trim() !== '') {
    parts.push(lead);
  }

  if (record.market.sourceCrd) {
    parts.push(`CRD #${record.market.sourceCrd}`);
  }

  return parts.length > 0 ? parts.join('  |  ') : null;
};
