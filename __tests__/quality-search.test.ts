import { describe, expect, it } from '@jest/globals';
import {
  searchCategories,
  searchDirectory,
  searchProviders,
} from '../src/features/discovery/search';
import { providers } from './fixtures/providers';
import type { ServiceProvider } from '../src/features/discovery/types';

const example = (
  categoryId: string,
  patch: Partial<ServiceProvider> = {},
): ServiceProvider => ({
  ...providers[0],
  id: categoryId,
  name: 'اسم تجريبي',
  serviceTitle: 'خدمة محلية',
  description: '',
  categoryId,
  ...patch,
});
describe('resident search terms', () => {
  it.each([
    ['سباك', 'plumbing'],
    ['سباكة', 'plumbing'],
    ['كهربائي', 'electricity'],
    ['كهرباء', 'electricity'],
    ['دكتور', 'clinics'],
    ['طبيب', 'clinics'],
    ['نجار', 'carpentry'],
    ['نجارة', 'carpentry'],
  ])(
    'finds %s by the supported category even without the term in provider copy',
    (query, category) => {
      const source = [example(category), example('transport')];
      expect(
        searchProviders(query, undefined, source).map((item) => item.id),
      ).toEqual([category]);
      expect(
        searchCategories(query, source).some((item) => item.id === category),
      ).toBe(true);
    },
  );
  it('does not broaden misspellings into unrelated results', () => {
    expect(searchProviders('نجارر', undefined, [example('carpentry')])).toEqual(
      [],
    );
  });
  it('finds provider descriptions and existing category keywords', () => {
    expect(
      searchCategories('تخصص نادر', [
        example('electricity', { description: 'تخصص نادر' }),
      ]).map((item) => item.id),
    ).toEqual(['electricity']);
    expect(
      searchProviders('أخشاب', undefined, [example('carpentry')]),
    ).toHaveLength(1);
  });
  it('prioritizes an exact service title ahead of prefix names and broad descriptions', () => {
    const source = [
      example('plumbing', { id: 'broad', description: 'صيانة منزلية' }),
      example('plumbing', { id: 'prefix', name: 'صيانة منزلية متخصصة' }),
      example('plumbing', { id: 'exact', serviceTitle: 'صيانة منزلية' }),
    ];
    expect(searchDirectory('صيانة منزلية', source)[0]).toMatchObject({
      type: 'provider',
      provider: { id: 'exact' },
    });
  });
  it('does not let category matches expose pending, rejected or unpublished records', () => {
    const source = [
      example('clinics', { id: 'pending', status: 'pending' }),
      example('clinics', { id: 'rejected', status: 'rejected' }),
      example('clinics', { id: 'hidden', publicationStatus: 'unpublished' }),
    ];
    expect(searchProviders('طبيب', undefined, source)).toEqual([]);
    expect(
      searchDirectory('طبيب', source).some((item) => item.type === 'provider'),
    ).toBe(false);
  });
});
