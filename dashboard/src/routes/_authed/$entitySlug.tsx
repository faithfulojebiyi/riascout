import { useState } from 'react';
import { css } from '@riascout-ui/styled-system/css';
import { createFileRoute } from '@tanstack/react-router';

import {
  entitiesControllerGetEntities,
  entitiesControllerGetEntityRecords,
} from '../../api/generated/entities/entities';
import { EntityGrid } from '../../modules/entities/components/grid/grid-shell';
import { GridToolbar } from '../../modules/entities/components/grid/grid-toolbar';
import { GRID_DEFAULT_COL_WIDTH } from '../../ui/primitives/data-grid';
import { TableSkeleton } from '../../ui/primitives/skeleton/table-skeleton';

type Search = { view?: string };

export const Route = createFileRoute('/_authed/$entitySlug')({
  validateSearch: (search: Record<string, unknown>): Search => ({
    view: typeof search.view === 'string' ? search.view : undefined,
  }),
  // without this the loader would not re-run when only the view changes
  loaderDeps: ({ search }) => ({ view: search.view }),
  pendingComponent: EntityPageSkeleton,
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

/**
 * The loader blocks on the entity and its view, so the page was blank until both
 * landed. Column count and widths are unknown at this point — the placeholder
 * columns are deliberately generic rather than pretending to know the view.
 */
function EntityPageSkeleton() {
  return (
    <div
      className={css({ display: 'flex', flexDirection: 'column', h: '100dvh' })}
    >
      <div
        className={css({
          borderBottomWidth: '1px',
          borderColor: 'brand.panel.4',
          flexShrink: '0',
          h: '2.75rem',
        })}
      />
      <div className={css({ display: 'flex', flex: '1', minH: '0' })}>
        <TableSkeleton
          columns={Array.from({ length: 6 }, (_, index) => ({
            key: `pending-${index}`,
            width: `${GRID_DEFAULT_COL_WIDTH}px`,
          }))}
        />
      </div>
    </div>
  );
}

function EntityPage() {
  const { entity, view, total } = Route.useLoaderData();
  const [selectedCrds, setSelectedCrds] = useState<string[]>([]);

  return (
    <div
      className={css({ display: 'flex', flexDirection: 'column', h: '100dvh' })}
    >
      {/* 2.75rem, as every other page-chrome header, so the rules all meet */}
      <header
        className={css({
          alignItems: 'center',
          borderBottomWidth: '1px',
          borderColor: 'brand.panel.4',
          display: 'flex',
          flexShrink: '0',
          gap: '3',
          h: '2.75rem',
          px: '3',
        })}
      >
        <h1 className={css({ fontSize: '2', fontWeight: '600' })}>
          {entity.name}
        </h1>
        <span className={css({ color: 'text.muted', fontSize: '1' })}>
          {total.toLocaleString()} records
        </span>
      </header>

      {view ? (
        <GridToolbar
          entityId={entity.id}
          entitySlug={entity.slug}
          onSortCleared={() => setSelectedCrds([])}
          selectedCrds={selectedCrds}
          view={view}
          views={entity.views}
        />
      ) : null}

      <div className={css({ flex: '1', minH: '0' })}>
        {view ? (
          // keyed so switching views rebuilds the grid rather than reusing its columns
          <EntityGrid
            entityId={entity.id}
            key={view.id}
            onSelectionChange={setSelectedCrds}
            view={view}
          />
        ) : (
          <p>No view configured</p>
        )}
      </div>
    </div>
  );
}
