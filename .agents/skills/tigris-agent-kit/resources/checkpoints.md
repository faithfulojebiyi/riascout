# Checkpoints — Snapshot and Restore

Capture the state of a bucket at a point in time, then restore from it later as a copy-on-write fork. The original bucket is never modified by `restore` — restore always produces a new bucket.

Think of checkpoints as labeled commits and `restore` as `git worktree` — it materializes a snapshot as an independent, writable workspace.

## API

```typescript
checkpoint(
  bucket: string,
  options?: {
    name?: string;
    config?: TigrisConfig;
  }
): Promise<TigrisResponse<{ snapshotId: string; name?: string; createdAt: Date }>>;

restore(
  bucket: string,
  snapshotId: string,
  options?: {
    forkName?: string;
    credentials?: { role: 'Editor' | 'ReadOnly' };
    config?: TigrisConfig;
  }
): Promise<TigrisResponse<{ bucket: string; credentials?: Credentials }>>;

listCheckpoints(
  bucket: string,
  options?: { config?: TigrisConfig }
): Promise<TigrisResponse<{
  checkpoints: Array<{ snapshotId: string; name?: string; createdAt: Date }>;
}>>;
```

## Prerequisites

The bucket being checkpointed must have **snapshots enabled** at creation. For workspaces, pass `enableSnapshots: true` to `createWorkspace`. For raw buckets, pass `enableSnapshot: true` to `createBucket`.

## Capturing a Checkpoint

```typescript
import { checkpoint } from '@tigrisdata/agent-kit';

const { data: ckpt, error } = await checkpoint('training-data', {
  name: 'epoch-50',
});
if (error) throw error;

// Persist ckpt.snapshotId in your database — you'll need it to restore
console.log(ckpt.snapshotId, ckpt.createdAt);
```

Names are optional but make checkpoints discoverable in `listCheckpoints`.

## Listing Checkpoints

```typescript
import { listCheckpoints } from '@tigrisdata/agent-kit';

const { data: list } = await listCheckpoints('training-data');
for (const c of list.checkpoints) {
  console.log(c.snapshotId, c.name, c.createdAt);
}
```

## Restoring

Restore creates a *new bucket* that materializes the snapshot. The source bucket is untouched.

```typescript
import { restore } from '@tigrisdata/agent-kit';

const { data: restored } = await restore(
  'training-data',
  ckpt.snapshotId,
  {
    forkName: 'training-data-retry',
    credentials: { role: 'Editor' },
  }
);

// restored.bucket is an independent fork at that point in time.
// Writes to restored.bucket do not affect 'training-data'.
```

## Common Patterns

### Checkpoint Before Risky Operation

```typescript
const { data: ckpt } = await checkpoint('production-data', {
  name: `pre-migration-${Date.now()}`,
});

try {
  await runMigration();
} catch (err) {
  // Roll back: materialize the pre-migration state as a fresh fork
  const { data: rollback } = await restore('production-data', ckpt.snapshotId, {
    forkName: 'production-data-rollback',
  });
  // Cut traffic over to rollback.bucket
  throw err;
}
```

### Branching Agent Trajectories

Save the agent's state at a decision point, then explore multiple continuations from it:

```typescript
const { data: ckpt } = await checkpoint(workspace.bucket, {
  name: 'decision-point',
});

// Branch A
const { data: branchA } = await restore(workspace.bucket, ckpt.snapshotId, {
  forkName: `${workspace.bucket}-branch-a`,
});

// Branch B
const { data: branchB } = await restore(workspace.bucket, ckpt.snapshotId, {
  forkName: `${workspace.bucket}-branch-b`,
});

// Run both, compare outputs, pick the winner
```

### Periodic Checkpoints in Long-Running Agents

```typescript
async function runAgentWithCheckpoints(workspace: Workspace) {
  for (let step = 0; step < totalSteps; step++) {
    await runStep(workspace, step);
    if (step % 10 === 0) {
      await checkpoint(workspace.bucket, { name: `step-${step}` });
    }
  }
}
```

## Cleanup

Checkpoints persist until explicitly deleted via the lower-level `@tigrisdata/storage` snapshot API. Restored fork buckets persist until deleted — call `tigris buckets delete <name>` or use the storage SDK.

For ephemeral exploration, treat the restored bucket as a workspace and tear it down when done.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `checkpoint` returns "snapshots not enabled" | Bucket created without snapshot support | Recreate the bucket with `enableSnapshot: true` |
| `restore` returns "snapshot not found" | Wrong `snapshotId` or it was deleted | Verify with `listCheckpoints` |
| Restored bucket is empty | Checkpoint was taken before any writes | Confirm with `listCheckpoints` timestamps; check source bucket had data |
| Writing to restored bucket affects original | Should never happen — restore is copy-on-write | File a bug; verify you're writing to `restored.bucket`, not the source |
