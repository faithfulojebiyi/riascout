# Workspaces — Per-Agent Buckets

Provision a dedicated bucket for a single agent: optional TTL for auto-cleanup of objects, and scoped credentials for least-privilege access.

Use workspaces when each agent starts empty and accumulates its own data. Use forks when each agent starts from a shared dataset.

## API

```typescript
createWorkspace(
  name: string,
  options?: {
    ttl?: { days?: number; hours?: number };
    enableSnapshots?: boolean;
    credentials?: { role: 'Editor' | 'ReadOnly' };
    config?: TigrisConfig;
  }
): Promise<TigrisResponse<Workspace>>;

teardownWorkspace(
  workspace: Workspace,
  options?: { config?: TigrisConfig }
): Promise<TigrisResponse<void>>;
```

`Workspace` shape:

```typescript
{
  bucket: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}
```

## Lifecycle Pattern

```typescript
import { createWorkspace, teardownWorkspace } from '@tigrisdata/agent-kit';

const { data: workspace, error } = await createWorkspace(`agent-${agentId}`, {
  ttl: { days: 1 },
  enableSnapshots: true,
  credentials: { role: 'Editor' },
});
if (error) throw error;

try {
  await runAgent({
    bucket: workspace.bucket,
    ...workspace.credentials,
  });
} finally {
  await teardownWorkspace(workspace);
}
```

## TTL Behavior

`ttl` configures lifecycle rules that **expire objects**, not the bucket itself. Use it as a safety net for objects an agent leaves behind. To remove the bucket, call `teardownWorkspace`.

| Setting | Effect |
|---|---|
| `ttl: { days: 1 }` | Objects auto-delete 24h after upload |
| `ttl: { hours: 6 }` | Objects auto-delete 6h after upload |
| Omitted | Objects persist until explicitly deleted |

## Enabling Snapshots

Set `enableSnapshots: true` when you want to call `checkpoint` on this workspace later. Cannot be retrofitted — decide at creation.

```typescript
const { data: workspace } = await createWorkspace('long-running-agent', {
  enableSnapshots: true,
});

// later...
import { checkpoint } from '@tigrisdata/agent-kit';
await checkpoint(workspace.bucket, { name: 'after-step-3' });
```

## Credentials Scoping

`credentials.role` issues a key scoped to *only this workspace's bucket*:

| Role | Use For |
|---|---|
| `Editor` | Agent that writes results |
| `ReadOnly` | Agent that only consumes inputs (rare for workspaces) |

If `credentials` is omitted, the workspace is created but no scoped key is issued — agents must use whatever credentials are already configured. Prefer scoped credentials in production.

## Common Patterns

### Ephemeral Scratch Space

Short-lived workspace for intermediate artifacts that don't need to outlive the agent:

```typescript
const { data: ws } = await createWorkspace(`scratch-${Date.now()}`, {
  ttl: { hours: 1 },
});
try {
  await runAgent(ws);
} finally {
  await teardownWorkspace(ws);
}
```

### Long-Running Agent With Checkpoints

```typescript
const { data: ws } = await createWorkspace(`assistant-${userId}`, {
  enableSnapshots: true,
  credentials: { role: 'Editor' },
});

// Take checkpoints periodically so you can roll back if the agent goes off-rails
const { data: ckpt } = await checkpoint(ws.bucket, { name: 'before-tool-use' });
```

### Per-User Sandboxes

```typescript
async function provisionForUser(userId: string) {
  return createWorkspace(`user-${userId}-sandbox`, {
    ttl: { days: 7 },
    credentials: { role: 'Editor' },
  });
}
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Bucket still exists after TTL elapsed | TTL expires objects, not buckets | Call `teardownWorkspace` to delete the bucket |
| `checkpoint` fails on workspace | `enableSnapshots: true` not set at creation | Recreate the workspace with snapshots enabled |
| Name collision on `createWorkspace` | Bucket names are globally unique on Tigris | Add a suffix (timestamp, UUID, agent ID) |
| Orphan workspaces accumulating | Missing `teardownWorkspace` on crash | Wrap agent run in `try/finally` |
