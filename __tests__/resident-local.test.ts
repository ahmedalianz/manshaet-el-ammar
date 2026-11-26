import { beforeEach, afterEach, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  localDirectory,
  resetLocalDirectory,
  flushLocalDirectory,
} from '../src/features/local/LocalDirectory';
import {
  saveDraft,
  readDraft,
  clearUserDrafts,
  draftEpoch,
  listDrafts,
} from '../src/features/local/drafts';
import { providerShareText } from '../src/features/local/sharing';
import type { ServiceProvider } from '../src/features/discovery/types';

const mockDeleteDraftPhoto = jest.fn();
jest.mock('../src/features/photos/draftFiles', () => ({
  deleteDraftPhoto: (...args: unknown[]) => mockDeleteDraftPhoto(...args),
}));
const provider: ServiceProvider = {
  id: 'p',
  name: 'أحمد',
  categoryId: 'plumbing',
  serviceTitle: 'سباك',
  description: 'صيانة',
  phone: '01012345678',

  address: 'شارع المدرسة',
  dataSource: 'firestore',
  status: 'approved',
  publicationStatus: 'published',
};
beforeEach(async () => {
  mockDeleteDraftPhoto.mockClear();
  await flushLocalDirectory();
  await AsyncStorage.clear();
  resetLocalDirectory();
  await localDirectory.hydrate();
});
afterEach(async () => {
  await flushLocalDirectory();
  jest.restoreAllMocks();
  jest.useRealTimers();
});
it('persists guest favorites and only public snapshots across process hydration', async () => {
  localDirectory.toggleFavorite('p', {
    ...provider,
    ownerId: 'secret',
    rejectionReason: 'private',
  } as ServiceProvider);
  await flushLocalDirectory();
  resetLocalDirectory();
  await localDirectory.hydrate();
  expect(localDirectory.getCachedProvider('p')).toMatchObject({
    id: 'p',
    cachedAt: expect.any(String),
  });
  expect(localDirectory.getCachedProvider('p')).not.toHaveProperty('ownerId');
  expect(localDirectory.getCachedProvider('p')).not.toHaveProperty(
    'rejectionReason',
  );
  localDirectory.toggleFavorite('p');
  await flushLocalDirectory();
});
it('keeps favorites when another page omits them, but removes contacts on confirmed unavailability', async () => {
  localDirectory.toggleFavorite('p', provider);
  localDirectory.rememberProviders([{ ...provider, id: 'other' }]);
  expect(localDirectory.getCachedProvider('p')).toBeTruthy();
  localDirectory.markUnavailable('p');
  expect(localDirectory.getCachedProvider('p')).toBeUndefined();
  await flushLocalDirectory();
  const stored = JSON.parse(
    (await AsyncStorage.getItem('directory.public.v1'))!,
  );
  expect(stored.favoriteIds).toContain('p');
});
it('expires public contacts after 30 days without renewing stale snapshots when favorited', () => {
  const old = new Date(Date.now() - 31 * 86400000).toISOString();
  localDirectory.toggleFavorite('p', { ...provider, cachedAt: old });
  expect(localDirectory.getCachedProvider('p')).toBeUndefined();
});
it('limits snapshots to 500 while retaining favorites first', () => {
  localDirectory.toggleFavorite('p', provider);
  localDirectory.rememberProviders(
    Array.from({ length: 505 }, (_, i) => ({ ...provider, id: `item-${i}` })),
  );
  expect(localDirectory.getCachedProviders()).toHaveLength(500);
  expect(localDirectory.getCachedProvider('p')).toBeTruthy();
});
it('surfaces corrupt storage safely', async () => {
  await AsyncStorage.setItem('directory.public.v1', '{broken');
  resetLocalDirectory();
  await expect(localDirectory.hydrate()).resolves.toBeUndefined();
  expect(localDirectory.getCachedProviders()).toEqual([]);
});
it('never puts drafts or publication consent in public storage and invalidates queued writes on logout', async () => {
  const values = {
    name: 'مسودة',
    categoryId: '',
    serviceTitle: '',
    description: '',
    phone: '',

    address: '',
  };
  await saveDraft('owner', 'new', {
    values,
    step: 2,
    sameNumber: true,
    savedAt: new Date().toISOString(),
    consent: true,
  } as Parameters<typeof saveDraft>[2]);
  const read = await readDraft('owner', 'new');
  expect(read?.values.name).toBe('مسودة');
  expect(read).not.toHaveProperty('consent');
  expect(await readDraft('other', 'new')).toBeNull();
  const epoch = draftEpoch('owner');
  await clearUserDrafts('owner');
  await saveDraft(
    'owner',
    'new',
    { values, step: 1, sameNumber: false, savedAt: new Date().toISOString() },
    epoch,
  );
  expect(await readDraft('owner', 'new')).toBeNull();
  expect(await listDrafts('owner')).toEqual([]);
});
it('does not acknowledge a failed draft write', async () => {
  jest
    .spyOn(AsyncStorage, 'setItem')
    .mockRejectedValueOnce(new Error('Storage full'));
  await expect(
    saveDraft('owner', 'new', {
      values: {
        name: '',
        categoryId: '',
        serviceTitle: '',
        description: '',
        phone: '',

        address: '',
      },
      step: 1,
      sameNumber: false,
      savedAt: new Date().toISOString(),
    }),
  ).rejects.toThrow('Storage full');
});
it('shares plain useful details and discloses the date of cached data', () => {
  const message = providerShareText({
    ...provider,
    serviceMode: 'mobile',
    address: '',
    cachedAt: '2026-11-12T12:00:00Z',
  });
  expect(message).toContain('أحمد');
  expect(message).toContain('سباك');
  expect(message).toContain('01012345678');
  expect(message).toContain('خدمة متنقلة');
  expect(message).toContain('بيانات محفوظة بتاريخ');
  expect(providerShareText(provider)).toContain('شارع المدرسة');
});
it('removes obsolete area and coverage fields from restored public cache and rewrites the clean snapshot', async () => {
  await AsyncStorage.setItem(
    'directory.public.v1',
    JSON.stringify({
      favoriteIds: ['p'],
      providers: [
        {
          ...provider,
          area: 'old',
          coverageAreas: ['all'],
          areaId: 'center',
          areadId: 'old-typo',
          cachedAt: new Date().toISOString(),
        },
      ],
      categories: [
        {
          id: 'tailoring',
          name: 'الخياطة والتطريز',
          description: '',
          icon: 'needle',
          group: 'trades',
          keywords: [],
        },
      ],
    }),
  );
  resetLocalDirectory();
  await localDirectory.hydrate();
  await flushLocalDirectory();
  expect(localDirectory.getCachedProvider('p')).not.toHaveProperty('area');
  const restored = JSON.parse(
    (await AsyncStorage.getItem('directory.public.v1'))!,
  );
  expect(restored.categories[0]?.icon).toBe('content-cut');
  expect(restored.providers[0]).not.toHaveProperty('coverageAreas');
  expect(restored.providers[0]).not.toHaveProperty('areaId');
  expect(restored.providers[0]).not.toHaveProperty('areadId');
  expect(restored.providers[0].address).toBe(provider.address);
});
it('recovers old drafts without exposing obsolete area and coverage fields and omits them from subsequent saves', async () => {
  const key = 'directory.draft.v1.legacy.new';
  await AsyncStorage.setItem(
    key,
    JSON.stringify({
      values: {
        name: 'قديم',
        categoryId: 'plumbing',
        serviceTitle: 'سباك',
        description: '',
        phone: '01012345678',
        address: 'شارع المدرسة',
        area: 'old',
        coverageAreas: ['all'],
        areaId: 'center',
      },
      step: 1,
      sameNumber: false,
      savedAt: new Date().toISOString(),
    }),
  );
  const draft = await readDraft('legacy', 'new');
  expect(draft?.values).not.toHaveProperty('coverageAreas');
  expect(draft?.values).not.toHaveProperty('areaId');
  expect(draft?.values).not.toHaveProperty('area');
  expect(draft?.values.address).toBe('شارع المدرسة');
  await saveDraft('legacy', 'new', draft!);
  expect(
    JSON.parse((await AsyncStorage.getItem(key))!).values,
  ).not.toHaveProperty('areaId');
});

it('retains only the single most recent draft per user and removes older photo files', async () => {
  const baseValues = {
    name: 'محمد',
    categoryId: 'plumbing',
    serviceTitle: 'سباك',
    description: '',
    phone: '01012345678',
    address: 'شارع المدرسة',
  };
  await saveDraft('owner', 'new', {
    values: baseValues,
    photoDraft: {
      action: 'replace',
      localUri: 'file:///documents/service-photo-drafts/old.jpg',
    },
    step: 1,
    sameNumber: false,
    savedAt: '2026-11-19T00:00:00.000Z',
  });
  await saveDraft('other', 'new', {
    values: { ...baseValues, name: 'حساب آخر' },
    step: 1,
    sameNumber: false,
    savedAt: '2026-11-19T00:01:00.000Z',
  });
  await saveDraft('owner', 'service-1', {
    values: { ...baseValues, name: 'أحدث مسودة' },
    step: 2,
    sameNumber: true,
    savedAt: '2026-11-19T00:02:00.000Z',
  });

  expect(await readDraft('owner', 'new')).toBeNull();
  const latest = await readDraft('owner', 'service-1');
  expect(latest?.values.name).toBe('أحدث مسودة');
  const listed = await listDrafts('owner');
  expect(listed).toHaveLength(1);
  expect(listed[0]?.id).toBe('service-1');
  expect(mockDeleteDraftPhoto).toHaveBeenCalledWith(
    'file:///documents/service-photo-drafts/old.jpg',
  );
  expect((await readDraft('other', 'new'))?.values.name).toBe('حساب آخر');
});
