import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Exercises Mastra's routes as mounted on the api: the identity hook, the
 * forced resource id, thread isolation between users, and that Nest's own
 * routes are untouched by the child plugin. The model-backed section only runs
 * with SPIKE_LLM=1 because it spends real tokens.
 */
describe('/agent (mastra mount)', () => {
  const base = `http://localhost:${process.env.PORT ?? 3320}`;
  const origin = { origin: base };
  const password = 'correct-horse-battery-staple';
  const agentId = 'assistant';

  let cookieA: string;
  let cookieB: string;
  const threadIds: string[] = [];

  const signUp = async (label: string): Promise<string> => {
    const response = await fetch(`${base}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...origin },
      body: JSON.stringify({
        email: `assistant-e2e-${label}-${Date.now()}@example.test`,
        password,
        name: `E2E ${label}`,
      }),
    });

    expect(response.status).toBe(200);

    return response.headers.get('set-cookie') ?? '';
  };

  const agentFetch = (
    cookie: string | null,
    path: string,
    init: RequestInit = {},
  ): Promise<Response> =>
    fetch(`${base}/agent${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
        ...init.headers,
      },
    });

  const createThread = async (cookie: string): Promise<string> => {
    const threadId = crypto.randomUUID();
    const response = await agentFetch(
      cookie,
      `/memory/threads?agentId=${agentId}`,
      {
        method: 'POST',
        body: JSON.stringify({
          threadId,
          resourceId: 'spoofed-by-client',
          title: 'e2e',
        }),
      },
    );

    expect(response.status).toBe(200);
    threadIds.push(threadId);

    return threadId;
  };

  beforeAll(async () => {
    cookieA = await signUp('a');
    cookieB = await signUp('b');
  });

  afterAll(async () => {
    for (const threadId of threadIds) {
      await agentFetch(
        cookieA,
        `/memory/threads/${threadId}?agentId=${agentId}`,
        {
          method: 'DELETE',
        },
      ).catch(() => undefined);
    }
  });

  it('rejects anonymous callers on every mastra route', async () => {
    expect((await agentFetch(null, '/agents')).status).toBe(401);
    expect(
      (
        await agentFetch(null, `/agents/${agentId}/stream`, {
          method: 'POST',
          body: JSON.stringify({ messages: 'hi' }),
        })
      ).status,
    ).toBe(401);
  });

  it('serves the agent with the workspace field dictionary in its instructions', async () => {
    const response = await agentFetch(cookieA, '/agents');

    expect(response.status).toBe(200);

    const agents = (await response.json()) as Record<
      string,
      { id: string; instructions: string; tools?: Record<string, unknown> }
    >;
    const assistant = agents[agentId];

    expect(assistant?.id).toBe(agentId);
    expect(assistant?.instructions).toContain('Field dictionary');
    expect(assistant?.instructions).toContain('advisor.state');
    expect(Object.keys(assistant?.tools ?? {})).toEqual(
      expect.arrayContaining([
        'search_advisers',
        'search_firms',
        'get_field_options',
        'lookup_firm',
        'get_firm_profile',
        'list_lists',
        'create_list',
        'add_to_list',
      ]),
    );
  });

  it('forces the workspace-scoped resource id and isolates threads by user', async () => {
    const threadId = await createThread(cookieA);

    const listA = (await (
      await agentFetch(cookieA, `/memory/threads?agentId=${agentId}`)
    ).json()) as { threads: { id: string; resourceId: string }[] };
    const mine = listA.threads.find((thread) => thread.id === threadId);

    expect(mine?.resourceId).toMatch(/^ws_.+:u_.+$/);
    expect(mine?.resourceId).not.toBe('spoofed-by-client');

    expect(
      (
        await agentFetch(
          cookieA,
          `/memory/threads/${threadId}/messages?agentId=${agentId}`,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await agentFetch(
          cookieB,
          `/memory/threads/${threadId}/messages?agentId=${agentId}`,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await agentFetch(
          cookieB,
          `/memory/threads/${threadId}?agentId=${agentId}`,
        )
      ).status,
    ).toBe(403);

    const listB = (await (
      await agentFetch(cookieB, `/memory/threads?agentId=${agentId}`)
    ).json()) as { threads: unknown[] };

    expect(listB.threads).toEqual([]);
  });

  it('leaves nest routes untouched by the child plugin', async () => {
    const response = await fetch(`${base}/prospecting/facets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookieA },
      body: JSON.stringify({ sourceKind: 'advisor' }),
    });

    expect(response.status).toBe(201);

    const body = (await response.json()) as { facets: unknown[] };

    expect(body.facets.length).toBeGreaterThan(0);
  });

  describe.skipIf(!process.env.SPIKE_LLM)(
    'model-backed turns (SPIKE_LLM=1)',
    () => {
      const prompts = [
        'How many advisers are in Texas at firms in the $1B to $5B AUM band?',
        'Find advisers in California who hold the Series 65 and moved in the last 90 days.',
        'Look up the firm Fisher Investments.',
      ];

      it('streams a tool call and records latency', async () => {
        const timings: { ttfbMs: number; totalMs: number }[] = [];

        for (const prompt of prompts) {
          const threadId = await createThread(cookieA);
          const started = performance.now();
          const response = await agentFetch(
            cookieA,
            `/agents/${agentId}/stream`,
            {
              method: 'POST',
              body: JSON.stringify({
                messages: prompt,
                memory: { thread: threadId },
              }),
            },
          );

          expect(response.status).toBe(200);

          const reader = response.body?.getReader();

          if (!reader) throw new Error('no body');

          let ttfbMs = 0;
          let text = '';
          const decoder = new TextDecoder();

          for (;;) {
            const { done, value } = await reader.read();

            if (done) break;
            if (!ttfbMs) ttfbMs = performance.now() - started;

            text += decoder.decode(value, { stream: true });
          }

          timings.push({ ttfbMs, totalMs: performance.now() - started });
          expect(text).toContain('tool-call');
        }

        const sorted = timings
          .map((timing) => timing.totalMs)
          .sort((a, b) => a - b);
        const p50 = sorted[Math.floor(sorted.length / 2)];

        console.log('assistant spike timings', { timings, p50 });
      }, 240_000);
    },
  );
});
