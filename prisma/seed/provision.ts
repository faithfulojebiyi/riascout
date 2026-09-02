/**
 * Re-provisions every workspace. Provisioning otherwise runs only when an
 * organization is created, so a column added to the allowlist afterwards never
 * reaches a workspace that already exists — no attribute, so no facet, and no
 * view field, so nothing to switch on in grid settings.
 *
 * Idempotent: an entity is matched by slug, an attribute by its stable key, and
 * a field by the attribute it points at.
 */
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../orm/app/client.js';
import { provisionWorkspace } from '../../libs/feature/entities/data/provision-workspace.js';

async function main(): Promise<void> {
  const connectionString = process.env.APP_DATABASE_URL;

  if (!connectionString) {
    throw new Error('APP_DATABASE_URL is required');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  const workspaces = await prisma.organization.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`provisioning ${workspaces.length} workspaces`);

  let attributes = 0;
  let attributesUpdated = 0;
  let fields = 0;

  for (const workspace of workspaces) {
    const result = await provisionWorkspace(prisma as never, workspace.id);

    attributes += result.attributesCreated;
    attributesUpdated += result.attributesUpdated;
    fields += result.fieldsCreated;

    if (
      result.attributesCreated > 0 ||
      result.attributesUpdated > 0 ||
      result.fieldsCreated > 0
    ) {
      console.log(
        `  ${workspace.name}: +${result.attributesCreated} attributes, ~${result.attributesUpdated} attributes, +${result.fieldsCreated} fields`,
      );
    }
  }

  console.log(
    `done: ${attributes} attributes added, ${attributesUpdated} attributes updated, ${fields} fields added`,
  );

  await prisma.$disconnect();
}

await main();
