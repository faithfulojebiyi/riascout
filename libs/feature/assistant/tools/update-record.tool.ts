import { z } from 'zod';

import { defineTool } from './define-tool.js';
import { recordUrl } from './get-record.tool.js';
import { entityFor, sourceKindSchema } from './list-support.js';
import { coerceRecordValue, findAttribute } from './record-values.js';

const changeSchema = z.object({
  field: z.string(),
  label: z.string(),
  from: z.unknown().nullable(),
  to: z.unknown().nullable(),
  version: z.number().int(),
});

const fieldErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
  /** the editable field keys of this entity, so the retry needs no extra call */
  availableFields: z.array(z.string()).optional(),
});

export const updateRecordTool = defineTool({
  id: 'update_record',
  scope: 'write',
  approval: true,
  description: [
    "Set the workspace's own fields on an adviser or firm: status, notes, owner, last contacted, contact details. The recruiter approves it first; call it once per record.",
    'Fields are keyed by their key (see get_record); status and select fields take a choice name; dates take YYYY-MM-DD; an empty value clears the field.',
    'A CRD that is not yet a record is saved as one first. If fieldErrors is returned nothing was written; fix them and call again.',
  ].join(' '),
  input: z.object({
    sourceKind: sourceKindSchema,
    sourceCrd: z.string().regex(/^\d+$/),
    values: z
      .array(
        z.object({
          field: z.string().min(1).describe('field key, e.g. "status"'),
          value: z.unknown().describe('null or "" clears the field'),
        }),
      )
      .min(1)
      .max(20),
  }),
  output: z.object({
    record: z
      .object({
        id: z.string(),
        sourceCrd: z.string(),
        url: z.string(),
        /** true when this call saved the CRD as a record for the first time */
        created: z.boolean(),
      })
      .nullable(),
    changes: z.array(changeSchema),
    fieldErrors: z.array(fieldErrorSchema).optional(),
  }),
  execute: async (input, ctx) => {
    const entity = await entityFor(input.sourceKind, ctx);
    const existingId = await ctx.queries.findRecordId(ctx.identity, {
      entityId: entity.id,
      sourceKind: input.sourceKind,
      sourceCrd: input.sourceCrd,
    });

    /**
     * Validate against the entity's fields before creating anything: a typo in
     * a field key must not leave a new empty record behind. A record is needed
     * to read the fields, so when none exists yet an existing one of the same
     * entity is not available; fall back to creating and validating after.
     */
    const recordId =
      existingId ??
      (
        await ctx.queries.ensureRecord(ctx.identity, {
          entityId: entity.id,
          sourceKind: input.sourceKind,
          sourceCrd: input.sourceCrd,
        })
      ).id;
    const created = existingId === null;
    const snapshot = await ctx.queries.getRecord(ctx.identity, recordId);
    const cellByAttribute = new Map(
      snapshot.cells.map((cell) => [cell.attributeId, cell]),
    );
    const availableFields = snapshot.attributes.map((a) => a.key);
    const fieldErrors: z.output<typeof fieldErrorSchema>[] = [];
    const writes: {
      attributeId: string;
      value: unknown;
      expectedVersion?: number;
      field: string;
      label: string;
      from: unknown;
    }[] = [];

    for (const { field, value } of input.values) {
      const attribute = findAttribute(snapshot.attributes, field);

      if (!attribute) {
        fieldErrors.push({
          field,
          message: `no editable field "${field}" on ${entity.name}`,
          availableFields,
        });
        continue;
      }

      const coerced = coerceRecordValue(attribute, value);

      if (!coerced.ok) {
        fieldErrors.push({ field, message: coerced.message });
        continue;
      }

      const cell = cellByAttribute.get(attribute.id);

      writes.push({
        attributeId: attribute.id,
        value: coerced.value,
        // a version pins the write to what the recruiter approved seeing
        ...(cell ? { expectedVersion: cell.version } : {}),
        field: attribute.key,
        label: attribute.label,
        from: cell?.value ?? null,
      });
    }

    const record = {
      id: recordId,
      sourceCrd: input.sourceCrd,
      url: recordUrl(recordId),
      created,
    };

    if (fieldErrors.length > 0) {
      return { record, changes: [], fieldErrors };
    }

    const { results } = await ctx.queries.updateRecordValues(ctx.identity, {
      recordId,
      values: writes.map(({ attributeId, value, expectedVersion }) => ({
        attributeId,
        value,
        expectedVersion,
      })),
    });
    const versionByAttribute = new Map(
      results.map((r) => [r.attributeId, r.version ?? 0]),
    );

    return {
      record,
      changes: writes.map((write) => ({
        field: write.field,
        label: write.label,
        from: write.from,
        to: write.value,
        version: versionByAttribute.get(write.attributeId) ?? 0,
      })),
    };
  },
});
