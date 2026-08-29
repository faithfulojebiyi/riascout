import { createFileRoute } from '@tanstack/react-router';

import { entitiesControllerGetEntities } from '../../api/generated/entities/entities';

export const Route = createFileRoute('/_authed/')({
  loader: () => entitiesControllerGetEntities(),
  component: Home,
});

function Home() {
  const { entities } = Route.useLoaderData();
  const { user } = Route.useRouteContext();

  return (
    <div style={{ fontFamily: 'system-ui', padding: 24 }}>
      <p>Signed in as {user.email}</p>
      <ul>
        {entities.map((entity) => (
          <li key={entity.id}>
            {entity.name} — {entity.recordCount} records,{' '}
            {entity.attributeCount} attributes
          </li>
        ))}
      </ul>
    </div>
  );
}
