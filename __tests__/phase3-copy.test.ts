import { describe, expect, it } from '@jest/globals';
import { exploreEmptyState } from '../src/features/discovery/emptyState';
describe('Explore constraint-aware empty copy', () => {
  it('names the actual query and selected section and labels reset-all', () => {
    const result = exploreEmptyState('  سباك  ', 'صحة');
    expect(result.title).toContain('سباك');
    expect(result.title).toContain('ضمن قسم صحة');
    expect(result.actionLabel).toBe('مسح البحث والفلاتر');
    expect(result.message).toBe('جرّب كلمة تانية أو غيّر القسم.');
  });
  it('distinguishes search-only and category-only results', () => {
    expect(exploreEmptyState('Plumber').actionLabel).toBe('مسح البحث');
    expect(exploreEmptyState('', 'صحة')).toMatchObject({
      title: 'مفيش أقسام متاحة ضمن صحة حاليًا.',
      actionLabel: 'مسح الفلاتر',
    });
  });
});
