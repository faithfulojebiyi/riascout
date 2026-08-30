import { ForbiddenException } from '@nestjs/common';

import type { z } from 'zod';

import type { AlsService } from '@system/als/als.service.js';

import { WorkspaceMetadataSchema } from './schema.js';

export type WorkspaceMetadata = z.infer<typeof WorkspaceMetadataSchema>;

/** every step writes as a known user into a known workspace, or not at all */
export const requireIdentity = (
  alsService: AlsService,
): { workspaceId: string; userId: string } => {
  const workspaceId = alsService.ctx.get('workspaceId');
  const userId = alsService.ctx.get('userId');

  if (!workspaceId || !userId) {
    throw new ForbiddenException('No active workspace for this session');
  }

  return { workspaceId, userId };
};

/**
 * better-auth types metadata as a plain string, and anything may have written
 * it, so a parse failure falls back to defaults rather than 500ing onboarding.
 */
export const readWorkspaceMetadata = (
  metadata: string | null,
): WorkspaceMetadata => {
  if (!metadata) {
    return { useCases: [] };
  }

  try {
    const parsed = WorkspaceMetadataSchema.safeParse(JSON.parse(metadata));

    return parsed.success ? parsed.data : { useCases: [] };
  } catch {
    return { useCases: [] };
  }
};
