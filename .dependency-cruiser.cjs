/**
 * Module boundaries. oxlint has no import/no-restricted-paths, so this is the enforcing gate.
 * See CLAUDE.md "Import Restrictions".
 */
module.exports = {
  forbidden: [
    {
      name: 'api-not-from-worker',
      comment: 'apps/api must not import from apps/worker',
      severity: 'error',
      from: { path: '^apps/api' },
      to: { path: '^apps/worker' },
    },
    {
      name: 'worker-not-from-api',
      comment: 'apps/worker must not import from apps/api',
      severity: 'error',
      from: { path: '^apps/worker' },
      to: { path: '^apps/api' },
    },
    {
      name: 'worker-no-als',
      comment: 'ALS is HTTP-request-scoped; the worker has no request. Pass identity in the event payload.',
      severity: 'error',
      from: { path: '^apps/worker' },
      to: { path: '^libs/system/als' },
    },
    {
      name: 'assistant-no-als',
      comment:
        'Assistant tools and the mastra provider run outside the Nest request scope; identity arrives via RequestContext, and only apps/api bridges it to ALS.',
      severity: 'error',
      from: { path: '^libs/(feature/assistant|providers/mastra)' },
      to: { path: '^libs/system/als' },
    },
    {
      name: 'libs-not-from-apps',
      comment: 'libs must not reach up into apps',
      severity: 'error',
      from: { path: '^libs' },
      to: { path: '^apps/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^dist|^orm|^dashboard|^plop-templates|\\.spec\\.ts$|\\.e2e-spec\\.ts$)' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.js', '.ts'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
}
