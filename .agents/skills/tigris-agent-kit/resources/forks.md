# Forks — Parallel Agent Copies

Give each of N agents its own isolated copy of a shared dataset using copy-on-write storage forks. Each fork is an independent bucket — agents read and write freely without affecting the original or each other.

Forks are instant at any data size and consume no extra storage until an agent writes something different.

## API

```typescript
createForks(
  baseBucket: string,
  count: number,
  options?: {
    prefix?: string;                          // controls fork bucket naming
    credentials?: { role: 'Editor' | 'ReadOnly' };
    config?: TigrisConfig;
  }
): Promise<TigrisResponse<ForkSet>>;

teardownForks(
  forkSet: ForkSet,
  options?: { config?: TigrisConfig }
): Promise<TigrisResponse<void>>;
```

`ForkSet` shape:

```typescript
{
  baseBucket: string;
  snapshotId: string;
  forks: Array<{
    bucket: string;
    credentials?: {
      accessKeyId: string;
      secretAccessKey: string;
    };
  }>;
}
```

## Prerequisites

The base bucket **must have snapshots enabled**. Existing buckets cannot be retrofitted — recreate with `enableSnapshot: true` if needed.

```typescript
import { createBucket } from '@tigrisdata/storage';

await createBucket('my-dataset', { enableSnapshot: true });
```

## Lifecycle Pattern

Always pair `createForks` with `teardownForks`. Use `try/finally` so a crashed agent run doesn't leak buckets:

```typescript
import { createForks, teardownForks } from '@tigrisdata/agent-kit';

const { data: forkSet, error } = await createForks('training-data', 8, {
  prefix: `run-${runId}`,
  credentials: { role: 'Editor' },
});
if (error) throw error;

try {
  await Promise.all(
    forkSet.forks.map((fork, i) =>
      runAgent({
        bucket: fork.bucket,
        accessKeyId: fork.credentials!.accessKeyId,
        secretAccessKey: fork.credentials!.secretAccessKey,
        seed: i,
      })
    )
  );
} finally {
  await teardownForks(forkSet);
}
```

## Using Forks With `@tigrisdata/storage`

Each fork has its own bucket and (optionally) its own credentials. Pass them via `config` on every SDK call:

```typescript
import { put, get } from '@tigrisdata/storage';

const fork = forkSet.forks[0];
const cfg = {
  bucket: fork.bucket,
  accessKeyId: fork.credentials!.accessKeyId,
  secretAccessKey: fork.credentials!.secretAccessKey,
};

await put('output.json', JSON.stringify(result), { config: cfg });
const { data } = await get('input.csv', 'string', { config: cfg });
```

## When to Use Forks vs Workspaces

| Need | Use |
|---|---|
| All agents start from the same dataset | **Forks** |
| Agents start empty and accumulate data | **Workspaces** |
| Want copy-on-write semantics | **Forks** |
| Want auto-expiring scratch space | **Workspaces** |

## Common Patterns

### Hyperparameter Sweep

```typescript
const configs = [
  { lr: 0.01, batchSize: 32 },
  { lr: 0.001, batchSize: 64 },
  { lr: 0.0001, batchSize: 128 },
];

const { data: forkSet } = await createForks('training-data', configs.length, {
  prefix: `sweep-${Date.now()}`,
});

const results = await Promise.all(
  forkSet.forks.map((fork, i) => trainModel(fork, configs[i]))
);

await teardownForks(forkSet);
```

### Reproducible Re-runs

Combine with `checkpoint` to run a sweep against a frozen point in time, even as the base bucket continues to evolve:

```typescript
import { checkpoint, restore } from '@tigrisdata/agent-kit';

const { data: ckpt } = await checkpoint('training-data', { name: 'sweep-baseline' });

// Later, reproduce the same sweep:
const { data: snapshot } = await restore('training-data', ckpt.snapshotId, {
  forkName: 'sweep-baseline-replay',
});
const { data: forkSet } = await createForks(snapshot.bucket, 3);
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `createForks` returns "snapshots not enabled" | Base bucket created without `enableSnapshot: true` | Recreate the base bucket with snapshots enabled, copy data over |
| Fork buckets accumulate, billing climbs | Missing `teardownForks` on error path | Wrap agent work in `try/finally` |
| Agent gets "access denied" | Forgot to pass per-fork credentials via `config` | Pass `fork.credentials` on every SDK call |
| Forks have stale data | Forks reflect the base at snapshot time, not live | Take a fresh snapshot or call `createForks` again |
