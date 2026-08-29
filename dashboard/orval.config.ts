import { defineConfig } from 'orval';

/**
 * Reads the live spec from the running api. The api sanitizes its own document
 * with nestjs-zod's cleanupOpenApiDoc, which downgrades 3.1 to 3.0 — orval
 * cannot resolve 3.1 refs, so generating against the raw doc yields `unknown`
 * for every response body.
 *
 * Start the api first: bun run start:dev:api
 */
const apiUrl = process.env.VITE_API_URL ?? 'http://localhost:3320';

export default defineConfig({
  riascout: {
    input: { target: `${apiUrl}/docs-json` },
    output: {
      client: 'axios-functions',
      mode: 'tags-split',
      clean: true,
      target: './src/api/generated',
      /** every request goes through the mutator: same-origin /api + credentials */
      override: { mutator: { name: 'apiClient', path: './src/api/client.ts' } },
    },
  },
});
