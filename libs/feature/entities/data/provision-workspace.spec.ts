import { describe, expect, it, vi } from 'vitest';

import type { SeedEntity } from './entity-definitions.js';
import {
  provisionWorkspace,
  type ProvisionClient,
} from './provision-workspace.js';

describe('provisionWorkspace', () => {
  it('updates stale system metadata in place while preserving the attribute id', async () => {
    const definition: SeedEntity = {
      name: 'Firm',
      slug: 'firm',
      sourceKind: 'firm',
      attributes: [
        {
          key: 'stable-key',
          label: 'Account Count',
          type: 'number',
          isMultiValue: false,
          referenceColumn: 'firm.account_count',
          isEditable: false,
          group: 'Firm metrics',
          visible: false,
          pinned: false,
          isPrimary: false,
          icon: 'hash',
          description: 'Total regulatory accounts reported on Form ADV.',
        },
      ],
    };
    const update = vi
      .fn<ProvisionClient['entityAttribute']['update']>()
      .mockResolvedValue({ id: 'attribute-1' });
    const create = vi.fn<ProvisionClient['entityAttribute']['create']>();
    const client = {
      entity: {
        findFirst: vi
          .fn<ProvisionClient['entity']['findFirst']>()
          .mockResolvedValue({ id: 'entity-1' }),
        create: vi.fn<ProvisionClient['entity']['create']>(),
      },
      entityAttribute: {
        findMany: vi
          .fn<ProvisionClient['entityAttribute']['findMany']>()
          .mockResolvedValue([
            {
              id: 'attribute-1',
              key: 'stable-key',
              label: 'Client Count',
              type: 'number',
              isMultiValue: false,
              referenceColumn: 'firm.client_count',
              isEditable: false,
              isSystem: true,
              isPrimary: false,
              isUnique: false,
              isEnriched: false,
              icon: 'users',
              description: null,
              group: 'Firm metrics',
            },
          ]),
        create,
        update,
      },
      entityAttributeChoice: {
        create: vi.fn<ProvisionClient['entityAttributeChoice']['create']>(),
      },
      entityView: {
        findFirst: vi
          .fn<ProvisionClient['entityView']['findFirst']>()
          .mockResolvedValue({ id: 'view-1' }),
        create: vi.fn<ProvisionClient['entityView']['create']>(),
      },
      entityViewField: {
        findMany: vi
          .fn<ProvisionClient['entityViewField']['findMany']>()
          .mockResolvedValue([{ id: 'field-1', position: '0|hzzzzz:' }]),
        create: vi.fn<ProvisionClient['entityViewField']['create']>(),
      },
      entityViewFieldPath: {
        findMany: vi
          .fn<ProvisionClient['entityViewFieldPath']['findMany']>()
          .mockResolvedValue([{ attributeId: 'attribute-1' }]),
        create: vi.fn<ProvisionClient['entityViewFieldPath']['create']>(),
      },
    } as unknown as ProvisionClient;

    const result = await provisionWorkspace(client, 'workspace-1', [
      definition,
    ]);

    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'attribute-1' },
      data: expect.objectContaining({
        label: 'Account Count',
        referenceColumn: 'firm.account_count',
        description: 'Total regulatory accounts reported on Form ADV.',
      }),
      select: { id: true },
    });
    expect(result.attributesUpdated).toBe(1);
  });
});
