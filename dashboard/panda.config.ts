import { defineConfig } from '@pandacss/dev';

import { riascoutUi } from './src/ui/theme/preset';

export default defineConfig({
  preflight: true,
  jsxFramework: 'react',
  include: ['./src/**/*.{ts,tsx}'],
  exclude: [],
  importMap: '@riascout-ui/styled-system',
  outdir: './src/ui/styled-system',
  prefix: 'riascout',
  presets: [riascoutUi],
  theme: { extend: {} },
});
