import { css } from '@riascout-ui/styled-system/css';
import { createFileRoute } from '@tanstack/react-router';

import {
  entitiesControllerGetEntities,
  entitiesControllerGetEntityRecords,
} from '../../api/generated/entities/entities';
import { EntityGrid } from '../../modules/entities/components/grid/grid-shell';

type Search = { view?: string };

export const Route = createFileRoute('/_authed/$entitySlug')({
  validateSearch: (search: Record<string, unknown>): Search => ({
    view: typeof search.view === 'string' ? search.view : undefined,
  }),
  // without this the loader would not re-run when only the view changes
  loaderDeps: ({ search }) => ({ view: search.view }),
  loader: async ({ params, deps }) => {
    const { entities } = await entitiesControllerGetEntities();
    const entity = entities.find((e) => e.slug === params.entitySlug);

    if (!entity) {
      throw new Error(`No entity "${params.entitySlug}" in this workspace`);
    }

    // one page purely to obtain the view definition; ag-grid fetches the rest
    const seed = await entitiesControllerGetEntityRecords({
      entityId: entity.id,
      viewId: deps.view ?? null,
      limit: 1,
    });

    return { entity, view: seed.view, total: seed.total };
  },
  component: EntityPage,
});

function EntityPage() {
  const { entity, view, total } = Route.useLoaderData();

  return (
    <div
      className={css({ display: 'flex', flexDirection: 'column', h: '100dvh' })}
    >
      <header
        className={css({
          alignItems: 'baseline',
          // same divider as the grid below it, so the two lines read as one rule
          borderBottomWidth: '1px',
          borderColor: 'brand.panel.4',
          display: 'flex',
          gap: '3',
          px: '5',
          py: '3',
        })}
      >
        <h1 className={css({ fontSize: 'lg', fontWeight: '600' })}>
          {entity.name}
        </h1>
        <span className={css({ color: 'text.muted', fontSize: 'sm' })}>
          {total.toLocaleString()} records
        </span>
      </header>

      <div className={css({ flex: '1', minH: '0' })}>
        {view ? (
          // keyed so switching views rebuilds the grid rather than reusing its columns
          <EntityGrid entityId={entity.id} key={view.id} view={view} />
        ) : (
          <p>No view configured</p>
        )}
      </div>
    </div>
  );
}
