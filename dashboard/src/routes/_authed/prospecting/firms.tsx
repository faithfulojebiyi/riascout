import { createFileRoute, useSearch } from '@tanstack/react-router';

import { ProspectingPage } from '../../../modules/prospecting/components/prospecting-page';

export const Route = createFileRoute('/_authed/prospecting/firms')({
  component: Page,
});

/**
 * `f` is the assistant's filter token. Read loosely rather than declared as a
 * search schema, which would make `search` mandatory on every link here.
 */
function Page() {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const f = typeof search.f === 'string' && search.f ? search.f : undefined;

  return <ProspectingPage encodedFilter={f} sourceKind="firm" />;
}
