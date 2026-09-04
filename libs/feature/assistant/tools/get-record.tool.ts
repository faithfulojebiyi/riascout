import { z } from 'zod';

import { defineTool } from './define-tool.js';
import { entityFor, sourceKindSchema } from './list-support.js';

export const recordUrl = (recordId: string): string => `/record/${recordId}`;

export const recordFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.string(),
  choices: z.array(z.string()),
  value: z.unknown().nullable(),
  version: z.number().int().nullable(),
});

export const getRecordTool = defineTool({
  id: 'get_record',
  scope: 'read',
  approval: false,
  description: [
    "The workspace's own notes on an adviser or firm: status, notes, owner, contact details and any other editable field, with current values.",
    'Call it before update_record when you are unsure of the field names, or to answer "what did we note about X". A CRD that was never saved returns record null; reading never creates a record.',
  ].join(' '),
  input: z.object({
    sourceKind: sourceKindSchema,
    sourceCrd: z.string().regex(/^\d+$/),
  }),
  output: z.object({
    record: z
      .object({ id: z.string(), sourceCrd: z.string(), url: z.string() })
      .nullable(),
    fields: z.array(recordFieldSchema),
    lists: z.array(z.string()),
  }),
  execute: async ({ sourceKind, sourceCrd }, ctx) => {
    const entity = await entityFor(sourceKind, ctx);
    const recordId = await ctx.queries.findRecordId(ctx.identity, {
      entityId: entity.id,
      sourceKind,
      sourceCrd,
    });

    // an unsaved CRD still has fields: the model needs their names to edit
    if (!recordId) {
      const attributes = await ctx.queries.getEntityAttributes(
        ctx.identity,
        entity.id,
      );

      return {
        record: null,
        fields: attributes.map((attribute) => ({
          key: attribute.label,
          label: attribute.label,
          type: attribute.type,
          choices: attribute.choices,
          value: null,
          version: null,
        })),
        lists: [],
      };
    }

    const snapshot = await ctx.queries.getRecord(ctx.identity, recordId);
    const cellByAttribute = new Map(
      snapshot.cells.map((cell) => [cell.attributeId, cell]),
    );

    return {
      record: { id: recordId, sourceCrd, url: recordUrl(recordId) },
      fields: snapshot.attributes.map((attribute) => {
        const cell = cellByAttribute.get(attribute.id);

        return {
          // the label is the name the model uses in update_record
          key: attribute.label,
          label: attribute.label,
          type: attribute.type,
          choices: attribute.choices,
          value: cell?.value ?? null,
          version: cell?.version ?? null,
        };
      }),
      lists: snapshot.lists,
    };
  },
});
