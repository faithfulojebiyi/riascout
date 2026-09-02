import type { AppPrismaService } from '@system/database/database.service.js';

/** above this a vocabulary is a lookup, not a set of labels */
export const CODE_VOCABULARY_MAX = 64;

export type CodeOption = { value: string; label: string };

type VocabularyReader = Pick<AppPrismaService, 'facetOption'>;

/**
 * Display labels for coded columns — aum_band renders as "$1B – $5B" rather than
 * the raw 1b_5b. Only closed vocabularies are read: firm_name has 32,009 options
 * and full_name 455,296, which are lookups, not labels, so the sizes are
 * established first and the large ones are never fetched.
 */
export const readCodeVocabularies = async (
  db: VocabularyReader,
  attributes: readonly { referenceColumn: string | null }[],
): Promise<Map<string, CodeOption[]>> => {
  const keys = [
    ...new Set(
      attributes
        .map((a) => a.referenceColumn)
        .filter((key): key is string => key !== null),
    ),
  ];

  if (keys.length === 0) {
    return new Map();
  }

  const counts = await db.facetOption.groupBy({
    by: ['allowKey'],
    where: { allowKey: { in: keys } },
    _count: { _all: true },
  });

  const closed = counts
    .filter((c) => c._count._all <= CODE_VOCABULARY_MAX)
    .map((c) => c.allowKey);

  if (closed.length === 0) {
    return new Map();
  }

  const options = await db.facetOption.findMany({
    where: { allowKey: { in: closed } },
    select: { allowKey: true, value: true, label: true },
    // the order the facet rail uses, so a picker built from either agrees
    orderBy: [{ allowKey: 'asc' }, { position: 'asc' }, { label: 'asc' }],
  });

  const byKey = new Map<string, CodeOption[]>();

  for (const { allowKey, value, label } of options) {
    byKey.set(allowKey, [...(byKey.get(allowKey) ?? []), { value, label }]);
  }

  return byKey;
};
