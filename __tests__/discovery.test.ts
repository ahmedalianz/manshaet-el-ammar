import { describe, expect, it, jest } from '@jest/globals';
import {
  searchDirectory,
  searchProviders,
  normalizeArabic,
} from '../src/features/discovery/search';
import { categoryEmptyState } from '../src/features/discovery/emptyState';
import { signInDestination } from '../src/features/provider/signInDestination';
import {
  contactUrl,
  launchContactUrl,
  openProviderContact,
} from '../src/features/discovery/contact';
import { providers } from './fixtures/providers';

const provider = (id: string, name: string, description = '') => ({
  ...providers[0],
  id,
  name,
  description,
  serviceTitle: 'خدمة',
});
const ids = (query: string, source = providers) =>
  searchDirectory(query, source)
    .filter((result) => result.type === 'provider')
    .map((result) => result.provider.id);
describe('search ranking and eligibility', () => {
  it('ranks exact names above partial names', () =>
    expect(
      ids('أحمد', [
        provider('partial', 'أحمد محمود'),
        provider('exact', 'أحمد'),
      ]),
    ).toEqual(['exact', 'partial']));
  it('ranks prefix names above broad description', () =>
    expect(
      ids('أحمد', [
        provider('broad', 'حسن', 'أحمد'),
        provider('prefix', 'أحمد محمود'),
      ]),
    ).toEqual(['prefix', 'broad']));
  it('keeps relevant providers ahead of broad categories', () =>
    expect(
      searchDirectory('سباك', [provider('exact', 'سباك')])[0],
    ).toMatchObject({ type: 'provider', provider: { id: 'exact' } }));
  it('normalizes Alef variants', () =>
    expect(normalizeArabic('إبراهيم')).toBe(normalizeArabic('ابراهيم')));
  it('normalizes diacritics and tatweel', () =>
    expect(normalizeArabic('أَحـْمَد')).toBe(normalizeArabic('احمد')));
  it('preserves equal score source order', () =>
    expect(ids('أحمد', [provider('a', 'أحمد'), provider('b', 'أحمد')])).toEqual(
      ['a', 'b'],
    ));
  it('excludes pending rejected and unpublished records', () => {
    const source = [
      provider('public', 'أحمد'),
      { ...provider('pending', 'أحمد'), status: 'pending' as const },
      { ...provider('rejected', 'أحمد'), status: 'rejected' as const },
      {
        ...provider('hidden', 'أحمد'),
        publicationStatus: 'unpublished' as const,
      },
    ];
    expect(ids('أحمد', source)).toEqual(['public']);
    expect(searchProviders('', undefined, source)).toHaveLength(1);
  });
});
describe('empty states', () => {
  it('prioritizes truly empty category', () =>
    expect(categoryEmptyState(0, 'x')).toMatchObject({
      title: 'لسه مفيش خدمات في القسم ده',
      action: 'explore',
    }));
  it('shows query mismatch', () =>
    expect(categoryEmptyState(1, 'x').action).toBe('query'));
  it('clearing query restores eligible providers', () => {
    expect(searchProviders('missing', undefined, providers)).toHaveLength(0);
    expect(searchProviders('', undefined, providers)).toHaveLength(
      providers.length,
    );
  });
});
describe('sign-in destination allowlist', () => {
  it.each([
    ['add', '/provider/add'],
    ['more', '/(tabs)/more'],
    ['my-services', '/(tabs)/my-services'],
    ['https://evil.test', '/(tabs)/my-services'],
    [undefined, '/(tabs)/my-services'],
  ])('maps %s safely', (next, expected) =>
    expect(signInDestination(next)).toBe(expected),
  );
  it('returns administrators to account controls', () =>
    expect(signInDestination('add', true)).toBe('/admin'));
});
describe('contact utility safety', () => {
  it.each(['01012345678', '+20 10 1234 5678', '00201012345678', '٠١٠١٢٣٤٥٦٧٨'])(
    'normalizes %s',
    (value) => expect(contactUrl(value, 'call')).toBe('tel:+201012345678'),
  );
  it.each(['123', '02012345678', '01012345678;123'])('rejects %s', (value) =>
    expect(contactUrl(value, 'call')).toBeNull(),
  );
  it('formats WhatsApp URLs', () =>
    expect(contactUrl('01012345678', 'whatsapp')).toBe(
      'https://wa.me/201012345678',
    ));
  it('never activates current domain fixture contact', async () =>
    expect(await openProviderContact()).toMatchObject({ ok: false }));
  it('returns a controlled unsupported URL failure', async () => {
    const openURL = jest.fn<() => Promise<void>>();
    expect(
      await launchContactUrl('tel:+201012345678', {
        canOpenURL: async () => false,
        openURL,
      }),
    ).toMatchObject({ ok: false });
    expect(openURL).not.toHaveBeenCalled();
  });
  it('handles launch rejection', async () =>
    expect(
      await launchContactUrl('tel:+201012345678', {
        canOpenURL: async () => true,
        openURL: async () => {
          throw new Error('missing');
        },
      }),
    ).toMatchObject({ ok: false }));
});
