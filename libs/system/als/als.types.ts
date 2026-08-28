import type { ClsStore } from 'nestjs-cls';

export type AlsContext = {
  requestId?: string;
  userId?: string;
  workspaceId?: string;
} & ClsStore;
