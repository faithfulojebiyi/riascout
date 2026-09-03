# Coordination — Event-Driven Pipelines

Wire up multi-agent pipelines using bucket notifications. When objects are created, deleted, or modified, Tigris fires a webhook — agents trigger on events instead of polling.

This is how you chain agents: agent A writes a result, Tigris fires a webhook, agent B starts. No queues, no schedulers — just object storage.

## API

```typescript
setupCoordination(
  bucket: string,
  options: {
    webhookUrl: string;
    filter?: string;
    auth?: { token: string };
    config?: TigrisConfig;
  }
): Promise<TigrisResponse<void>>;

teardownCoordination(
  bucket: string,
  options?: { config?: TigrisConfig }
): Promise<TigrisResponse<void>>;
```

## Basic Setup

```typescript
import { setupCoordination, teardownCoordination } from '@tigrisdata/agent-kit';

await setupCoordination('pipeline-bucket', {
  webhookUrl: 'https://my-service.com/webhook',
  filter: 'WHERE `key` REGEXP "^results/"',
  auth: { token: process.env.WEBHOOK_SECRET! },
});

// Disable when done
await teardownCoordination('pipeline-bucket');
```

## Filter Syntax

`filter` is a SQL `WHERE` clause evaluated against event metadata. Common columns:

| Column | Description | Example |
|---|---|---|
| `key` | Object path | `WHERE \`key\` REGEXP "^results/"` |
| `event` | Event type | `WHERE event = 'created'` |
| `size` | Object size in bytes | `WHERE size > 1000000` |

Common combinations:

```sql
-- Only fire on creation in a specific prefix
WHERE event = 'created' AND `key` REGEXP "^outputs/"

-- Only fire on large uploads
WHERE event = 'created' AND size > 10485760

-- Skip thumbnails
WHERE `key` NOT REGEXP "thumb_"
```

Backticks around `key` are required because it's a reserved word.

## Webhook Authentication

When `auth.token` is set, Tigris includes it in the `Authorization` header so your endpoint can verify the call is legitimate:

```typescript
// In your webhook handler
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const event = await req.json();
  await handleEvent(event);
  return NextResponse.json({ ok: true });
}
```

## Webhook Payload

The webhook body contains event metadata. Typical fields:

```typescript
{
  bucket: string;
  key: string;
  event: 'created' | 'deleted' | 'modified';
  size?: number;
  contentType?: string;
  timestamp: string;
}
```

## Common Patterns

### Two-Stage Pipeline

Agent A writes raw results; webhook triggers agent B to post-process:

```typescript
// In setup script
await setupCoordination('agent-a-output', {
  webhookUrl: 'https://workers.example.com/agent-b',
  filter: 'WHERE event = "created" AND `key` REGEXP "^raw/"',
  auth: { token: process.env.WEBHOOK_SECRET! },
});

// Agent A
import { put } from '@tigrisdata/storage';
await put('raw/result-123.json', JSON.stringify(result), {
  config: { bucket: 'agent-a-output' },
});
// Tigris fires webhook → agent B picks up the job
```

### Fan-Out

Set up coordination on one bucket pointing at a dispatcher that fans out to many workers. Use the `key` prefix to route.

### Fan-In With Synthesis

Multiple agents write to a shared bucket; webhook triggers a synthesis agent when results land:

```typescript
await setupCoordination('shared-results', {
  webhookUrl: 'https://workers.example.com/synthesizer',
  filter: 'WHERE event = "created" AND `key` REGEXP "^run-42/agent-"',
  auth: { token: process.env.WEBHOOK_SECRET! },
});
```

The synthesizer can `list()` the bucket to check whether all expected agents have reported in before producing the final answer.

## Lifecycle

Coordination is bucket-level configuration, not per-call. Set it once at provisioning time and tear it down when the pipeline is decommissioned. There's no harm leaving it running on long-lived buckets — the cost is just the webhooks themselves.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Webhook never fires | `filter` syntax is invalid or matches nothing | Test with `filter` omitted first; add filter once you confirm events flow |
| Webhook fires too often | Filter too broad | Tighten `filter` — match `event = 'created'` and a key prefix |
| Webhooks return 401 from your service | Token mismatch between `setupCoordination` and your handler | Verify `auth.token` matches the secret your handler checks |
| Endpoint receives duplicate events | At-least-once delivery — Tigris may retry on failure | Make handlers idempotent (dedupe by `bucket` + `key` + `timestamp`) |
| Webhook arrives before object is readable | Rare race; webhook can outpace eventual consistency | Retry the read with brief backoff in the handler |
