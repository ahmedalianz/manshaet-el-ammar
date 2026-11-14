export function categoryEmptyState(
  count: number,
  query: string,
  categoryName?: string,
) {
  if (!count)
    return {
      title: 'لسه مفيش خدمات في القسم ده',
      message: 'تقدر تستكشف أقسام تانية لحد ما تتضاف خدمات جديدة.',
      actionLabel: 'استكشف الأقسام',
      action: 'explore' as const,
    };
  if (query.trim())
    return {
      title: categoryName
        ? `مفيش نتائج لـ «\u2068${query.trim()}\u2069» ضمن قسم ${categoryName}.`
        : 'ملقيناش نتائج للبحث ده',
      message: 'جرّب كلمة تانية أو امسح البحث.',
      actionLabel: 'مسح البحث',
      action: 'query' as const,
    };
  return {
    title: 'مفيش خدمات متاحة دلوقتي',
    message: 'تقدر تستكشف أقسام تانية.',
    actionLabel: 'استكشف الأقسام',
    action: 'explore' as const,
  };
}

export function exploreEmptyState(query: string, section?: string) {
  const term = query.trim();
  const quoted = `«⁨${term}⁩»`;
  return {
    title: term
      ? `مفيش نتائج لـ ${quoted}${section ? ` ضمن قسم ${section}` : ''}.`
      : section
        ? `مفيش أقسام متاحة ضمن ${section} حاليًا.`
        : 'مفيش أقسام متاحة دلوقتي',
    message:
      term && section
        ? 'جرّب كلمة تانية أو غيّر القسم.'
        : term
          ? 'جرّب كلمة تانية أو امسح البحث.'
          : 'جرّب عرض كل الأقسام.',
    actionLabel:
      term && section
        ? 'مسح البحث والفلاتر'
        : term
          ? 'مسح البحث'
          : 'مسح الفلاتر',
  };
}
