import { categories } from './data/categories';
import type { ServiceCategory, ServiceProvider } from './types';

const categorySynonyms: Record<string, readonly string[]> = {
  plumbing: ['سباك', 'سباكة'],
  electricity: ['كهربائي', 'كهرباء'],
  clinics: ['دكتور', 'طبيب'],
  pharmacies: ['صيدلي', 'صيدلية'],
  carpentry: ['نجار', 'نجارة'],
  tailoring: ['ترزي', 'خياط'],
  laundry: ['مكوجي', 'مغسلة'],
  construction: ['نقاش', 'محارة'],
  'sewage-trucks': ['كسح'],
  other: ['تانية', 'ثانية'],
};
function matchesCategory(category: ServiceCategory, query: string) {
  return (
    matchesQuery(category.name, query) ||
    category.keywords.some((keyword) => matchesQuery(keyword, query)) ||
    (categorySynonyms[category.id] ?? []).some(
      (term) => normalizeArabic(term) === normalizeArabic(query),
    )
  );
}

export function normalizeArabic(value: string): string {
  return value
    .toLocaleLowerCase('ar')
    .normalize('NFD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئىي]/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

function matchesQuery(value: string, query: string): boolean {
  return normalizeArabic(value).includes(normalizeArabic(query));
}

function nameRank(name: string, query: string): number {
  const value = normalizeArabic(name);
  const term = normalizeArabic(query);
  return value === term
    ? 0
    : value.startsWith(term)
      ? 1
      : value.includes(term)
        ? 2
        : 4;
}

function providerRank(provider: ServiceProvider, query: string): number {
  return Math.min(
    nameRank(provider.name, query),
    nameRank(provider.serviceTitle, query),
  );
}

export function searchCategories(
  query: string,
  source: ServiceProvider[],
  categorySource = categories,
) {
  const approvedProviders = source.filter(
    (provider) =>
      provider.status === 'approved' &&
      provider.publicationStatus !== 'unpublished',
  );

  return categorySource.filter((category) => {
    if (!query.trim()) return true;
    const relatedProviders = approvedProviders.filter(
      (provider) => provider.categoryId === category.id,
    );
    return (
      matchesCategory(category, query) ||
      [
        category.name,
        category.description,
        ...category.keywords,
        ...relatedProviders.flatMap((provider) => [
          provider.name,
          provider.serviceTitle,
          provider.description,
          provider.address,
        ]),
      ].some((value) => matchesQuery(value, query))
    );
  });
}

export function searchProviders(
  query: string,
  categoryId: string | undefined,
  source: ServiceProvider[],
  categorySource = categories,
) {
  const matches = source.filter((provider) => {
    if (
      provider.status !== 'approved' ||
      provider.publicationStatus === 'unpublished'
    )
      return false;
    if (categoryId && provider.categoryId !== categoryId) return false;
    if (!query.trim()) return true;
    const category = categorySource.find(
      (item) => item.id === provider.categoryId,
    );
    return (
      Boolean(category && matchesCategory(category, query)) ||
      [
        provider.name,
        provider.serviceTitle,
        provider.description,
        provider.address,
      ].some((value) => matchesQuery(value, query))
    );
  });
  if (!normalizeArabic(query)) return matches;
  return matches.sort(
    (a, b) => providerRank(a, query) - providerRank(b, query),
  );
}

export function searchDirectory(
  query: string,
  source: ServiceProvider[],
  categorySource = categories,
) {
  if (!normalizeArabic(query)) return [];

  const categoryResults = searchCategories(query, source, categorySource).map(
    (category) => ({
      type: 'category' as const,
      category,
    }),
  );
  const providerResults = searchProviders(
    query,
    undefined,
    source,
    categorySource,
  ).map((provider) => ({
    type: 'provider' as const,
    provider,
  }));

  const rank = (
    result: (typeof categoryResults)[number] | (typeof providerResults)[number],
  ) => {
    if (result.type === 'category')
      return nameRank(result.category.name, query);
    return providerRank(result.provider, query);
  };
  return [...categoryResults, ...providerResults]
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, 6);
}
