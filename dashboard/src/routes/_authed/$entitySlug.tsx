import { css } from '@riascout-ui/styled-system/css';
import { createFileRoute } from '@tanstack/react-router';

import {
  entitiesControllerGetEntities,
  entitiesControllerGetEntityRecords,
} from '../../api/generated/entities/entities';
import { EntityGrid } from '../../modules/entities/components/grid/grid-shell';

export const Route = createFileRoute('/_authed/$entitySlug')({
  loader: async ({ params }) => {
    const { entities } = await entitiesControllerGetEntities();
    const entity = entities.find((e) => e.slug === params.entitySlug);

    if (!entity) {
      throw new Error(`No entity "${params.entitySlug}" in this workspace`);
    }

    // one page purely to obtain the view definition; ag-grid fetches the rest
    const seed = await entitiesControllerGetEntityRecords({
      entityId: entity.id,
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
          borderBottomWidth: '1px',
          borderColor: 'brand.primary.5',
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
          <EntityGrid entityId={entity.id} view={view} />
        ) : (
          <p>No view configured</p>
        )}
      </div>
    </div>
  );
}
