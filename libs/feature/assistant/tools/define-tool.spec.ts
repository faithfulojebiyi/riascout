import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { defineTool, type ToolContext } from './define-tool.js';

const context: ToolContext = {
  identity: { userId: 'u1', workspaceId: 'w1' },
  queries: {
    getFacets: () => Promise.resolve([]),
    searchAdvisors: () =>
      Promise.resolve({ rows: [], total: 0, limit: 10, offset: 0 }),
    lookupFirm: () => Promise.resolve([]),
    searchFacetOptions: () => Promise.resolve([]),
    getFirmProfile: () => Promise.reject(new Error('not used')),
  },
};

describe('defineTool', () => {
  it('types execute by its schemas and passes identity through', async () => {
    const echo = defineTool({
      id: 'echo',
      description: 'echoes the workspace',
      input: z.object({ text: z.string() }),
      output: z.object({ text: z.string(), workspaceId: z.string() }),
      scope: 'read',
      approval: false,
      execute: (input, ctx) =>
        Promise.resolve({
          text: input.text,
          workspaceId: ctx.identity.workspaceId,
        }),
    });

    await expect(echo.execute({ text: 'hi' }, context)).resolves.toEqual({
      text: 'hi',
      workspaceId: 'w1',
    });
    expect(
      echo.output.safeParse({ text: 'hi', workspaceId: 'w1' }).success,
    ).toBe(true);
  });
});
