import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

config({ path: '.env', quiet: true });
config({ path: 'apps/api/.env', quiet: true });

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

/**
 * Aliases are declared explicitly rather than via vite-tsconfig-paths: the
 * composite app tsconfigs confuse the plugin's project discovery.
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@orm\/app\/sql\/(.*)\.js$/, replacement: `${r('./orm/app/sql/')}$1.ts` },
      { find: '@orm/app', replacement: r('./orm/app/client.ts') },
      { find: /^@system\/(.*)\.js$/, replacement: `${r('./libs/system/')}$1.ts` },
      { find: /^@feature\/(.*)\.js$/, replacement: `${r('./libs/feature/')}$1.ts` },
      { find: /^@providers\/(.*)\.js$/, replacement: `${r('./libs/providers/')}$1.ts` },
      { find: /^@api\/(.*)\.js$/, replacement: `${r('./apps/api/src/')}$1.ts` },
      { find: /^@worker\/(.*)\.js$/, replacement: `${r('./apps/worker/src/')}$1.ts` },
    ],
  },
  test: {
    globals: true,
    root: './',
    include: ['{apps,libs}/**/*.e2e-spec.ts'],
    /** these hit a running api; one at a time keeps fixtures from colliding */
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
