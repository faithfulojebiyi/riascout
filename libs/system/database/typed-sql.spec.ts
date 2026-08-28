import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaClient } from '@orm/app';
import { advisorsAtFirmOn } from '@orm/app/sql/advisorsAtFirmOn.js';

/**
 * Proves the TypedSQL path works end to end: a .sql file under prisma/sql/
 * becomes a typed function whose result types are derived from the database.
 */
describe('typed sql', () => {
  let prisma: PrismaClient;
  const firmCrd = 999_000_402n;
  const advisorCrd = 999_000_403n;

  beforeAll(async () => {
    const connectionString = process.env.APP_DATABASE_URL;

    if (!connectionString) {
      throw new Error('APP_DATABASE_URL is required to run typed sql tests');
    }

    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

    await prisma.firm.upsert({ where: { firmCrd }, create: { firmCrd }, update: {} });
    await prisma.advisor.upsert({ where: { advisorCrd }, create: { advisorCrd }, update: {} });

    // two jurisdictions at the same firm — the query must not double-count
    await prisma.advisorRegistration.createMany({
      data: ['IN', 'OH'].map((jurisdiction) => ({
        advisorCrd,
        employerFirmCrd: firmCrd,
        sourceEmployerName: 'Typed SQL Fixture',
        jurisdiction,
        startDate: new Date('2021-01-01'),
        endDate: new Date('2024-01-01'),
      })),
    });
  });

  afterAll(async () => {
    await prisma.advisorRegistration.deleteMany({ where: { advisorCrd } });
    await prisma.advisor.deleteMany({ where: { advisorCrd } });
    await prisma.firm.deleteMany({ where: { firmCrd } });
    await prisma.$disconnect();
  });

  it('returns the advisor once when the as-of date falls inside the tenure', async () => {
    const rows = await prisma.$queryRawTyped(advisorsAtFirmOn(firmCrd, new Date('2022-06-01')));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.advisor_crd).toBe(advisorCrd);
    expect(rows[0]?.source_employer_name).toBe('Typed SQL Fixture');
  });

  it('excludes the advisor once the registration has closed', async () => {
    const rows = await prisma.$queryRawTyped(advisorsAtFirmOn(firmCrd, new Date('2025-06-01')));

    expect(rows).toHaveLength(0);
  });

  it('treats the interval as half-open: the end date itself is excluded', async () => {
    const rows = await prisma.$queryRawTyped(advisorsAtFirmOn(firmCrd, new Date('2024-01-01')));

    expect(rows).toHaveLength(0);
  });
});
