import { fileURLToPath } from 'node:url';

import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  server: { port: 3020 },
  resolve: {
    alias: [
      // panda's importMap; tsconfig paths cover typescript, vite needs its own
      { find: '@riascout-ui/styled-system', replacement: r('./src/ui/styled-system') },
    ],
  },
  plugins: [tanstackStart(), react()],
});
