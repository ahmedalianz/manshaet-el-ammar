import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import type { ServiceCategory, ServiceProvider } from '../discovery/types';
import { normalizeContactNumber } from '../discovery/contact';
import { validateAvailability } from '../availability/validation';

const KEY = 'directory.public.v1';
const TTL = 30 * 86400000;
type Snapshot = {
  unavailableIds: string[];
  favoriteIds: string[];
  providers: ServiceProvider[];
  categories: ServiceCategory[];
  hydrated: boolean;
  storageError: string | null;
};
let state: Snapshot = {
  unavailableIds: [],
  favoriteIds: [],
  providers: [],
  categories: [],
  hydrated: false,
  storageError: null,
};
const listeners = new Set<() => void>();
let hydration: Promise<void> | undefined;
let writes = Promise.resolve();
const emit = () => listeners.forEach((listener) => listener());
function cleanProvider(
  value: ServiceProvider,
  savedAt: string,
): ServiceProvider | null {
  if (
    !value ||
    value.dataSource !== 'firestore' ||
    value.status !== 'approved' ||
    value.publicationStatus !== 'published' ||
    !normalizeContactNumber(value.phone)
  )
    return null;
  for (const key of [
    'id',
    'name',
    'categoryId',
    'serviceTitle',
    'description',

    'address',
  ] as const)
    if (typeof value[key] !== 'string' || value[key].length > 2000) return null;
  if (
    !/^[A-Za-z0-9_-]{1,128}$/.test(value.id) ||
    !value.name ||
    !value.serviceTitle ||
    Object.keys(validateAvailability(value)).length
  )
    return null;
  return {
    id: value.id,
    name: value.name,
    categoryId: value.categoryId,
    serviceTitle: value.serviceTitle,
    description: value.description,

    address: value.address,
    phone: value.phone,
    ...(normalizeContactNumber(value.whatsapp)
      ? { whatsapp: value.whatsapp }
      : {}),
    status: 'approved',
    publicationStatus: 'published',
    dataSource: 'firestore',
    ...(value.serviceMode ? { serviceMode: value.serviceMode } : {}),
    ...(value.coverageAreas ? { coverageAreas: [...value.coverageAreas] } : {}),
    ...(value.weeklyHours ? { weeklyHours: value.weeklyHours } : {}),
    ...(validDate(value.updatedAt) ? { updatedAt: value.updatedAt } : {}),
    ...(validDate(value.lastConfirmedAt)
      ? { lastConfirmedAt: value.lastConfirmedAt }
      : {}),
    cachedAt: savedAt,
  };
}
const validDate = (value?: string) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
function cleanCategory(value: ServiceCategory): ServiceCategory | null {
  if (
    !value ||
    !['id', 'name', 'description', 'icon', 'group'].every(
      (key) => typeof value[key as keyof ServiceCategory] === 'string',
    ) ||
    !['health', 'trades', 'shops', 'community'].includes(value.group) ||
    !Array.isArray(value.keywords)
  )
    return null;
  return {
    ...(validDate(value.cachedAt) ? { cachedAt: value.cachedAt } : {}),
    id: value.id,
    name: value.name,
    description: value.description,
    icon: value.icon,
    group: value.group,
    keywords: value.keywords
      .filter((word) => typeof word === 'string')
      .slice(0, 50),
  };
}
function prune(items: ServiceProvider[], favorites: string[]) {
  return [
    ...new Map(
      items
        .filter(
          (item) =>
            validDate(item.cachedAt) &&
            Date.now() >= Date.parse(item.cachedAt!) &&
            Date.now() - Date.parse(item.cachedAt!) < TTL,
        )
        .map((item) => [item.id, item]),
    ).values(),
  ]
    .sort(
      (a, b) =>
        Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)) ||
        Date.parse(b.cachedAt!) - Date.parse(a.cachedAt!),
    )
    .slice(0, 500);
}
function update(change: Partial<Snapshot>) {
  state = { ...state, ...change };
  state.providers = prune(state.providers, state.favoriteIds);
  emit();
  const saved = JSON.stringify({
    favoriteIds: state.favoriteIds,
    unavailableIds: state.unavailableIds,
    providers: state.providers,
    categories: state.categories,
  });
  writes = writes
    .catch(() => {})
    .then(() => AsyncStorage.setItem(KEY, saved))
    .catch(() => {
      state = {
        ...state,
        storageError:
          'مش قادرين نحفظ على الجهاز. التغييرات متاحة للجلسة دي بس.',
      };
      emit();
    });
}
export const localDirectory = {
  hydrate() {
    hydration ??= AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) {
          const data = JSON.parse(raw);
          const favoriteIds = Array.isArray(data.favoriteIds)
            ? [
                ...new Set<string>(
                  data.favoriteIds.filter(
                    (id: unknown) => typeof id === 'string' && id.length < 200,
                  ),
                ),
              ]
            : [];
          const providers = Array.isArray(data.providers)
            ? data.providers
                .map((item: ServiceProvider) =>
                  cleanProvider(item, item.cachedAt ?? ''),
                )
                .filter(Boolean)
            : [];
          const categories = Array.isArray(data.categories)
            ? data.categories.map(cleanCategory).filter(Boolean)
            : [];
          state = {
            ...state,
            favoriteIds,
            unavailableIds: Array.isArray(data.unavailableIds)
              ? data.unavailableIds
                  .filter((id: unknown) => typeof id === 'string')
                  .slice(-500)
              : [],
            providers: prune(providers, favoriteIds),
            categories,
          };
          if (
            Array.isArray(data.providers) &&
            data.providers.some(
              (item: unknown) =>
                item &&
                typeof item === 'object' &&
                ['area', 'areaId', 'areadId'].some((key) => key in item),
            )
          ) {
            update({});
            return writes;
          }
        }
      })
      .catch(() => {
        state = {
          ...state,
          storageError: 'مش قادرين نقرأ البيانات المحفوظة على الجهاز.',
        };
      })
      .finally(() => {
        state = { ...state, hydrated: true };
        emit();
      });
    return hydration;
  },
  rememberProviders(items: ServiceProvider[]) {
    update({
      unavailableIds: state.unavailableIds.filter(
        (id) => !items.some((item) => item.id === id && !item.cachedAt),
      ),
      providers: [
        ...state.providers.filter(
          (old) => !items.some((item) => item.id === old.id),
        ),
        ...items
          .map((item) =>
            cleanProvider(item, item.cachedAt ?? new Date().toISOString()),
          )
          .filter((item): item is ServiceProvider => Boolean(item)),
      ],
    });
  },
  rememberCategories(items: ServiceCategory[]) {
    update({
      categories: items
        .map((item) =>
          cleanCategory({ ...item, cachedAt: new Date().toISOString() }),
        )
        .filter((item): item is ServiceCategory => Boolean(item)),
    });
  },
  getCachedProvider(id: string) {
    return localDirectory.getCachedProviders().find((item) => item.id === id);
  },
  getCachedProviders() {
    return prune(state.providers, state.favoriteIds).filter(
      (item) => !state.unavailableIds.includes(item.id),
    );
  },
  getCachedCategories() {
    return state.categories.filter(
      (item) =>
        validDate(item.cachedAt) &&
        Date.now() - Date.parse(item.cachedAt!) >= 0 &&
        Date.now() - Date.parse(item.cachedAt!) < TTL,
    );
  },
  markUnavailable(id: string) {
    update({
      unavailableIds: [
        ...state.unavailableIds.filter((item) => item !== id),
        id,
      ].slice(-500),
      providers: state.providers.filter((item) => item.id !== id),
    });
  },
  toggleFavorite(id: string, provider?: ServiceProvider) {
    if (!state.hydrated) return;
    if (provider) localDirectory.rememberProviders([provider]);
    update({
      favoriteIds: state.favoriteIds.includes(id)
        ? state.favoriteIds.filter((value) => value !== id)
        : [...state.favoriteIds, id],
    });
  },
  clearFavorites() {
    update({ favoriteIds: [] });
  },
};
export function LocalDirectoryProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void localDirectory.hydrate();
  }, []);
  return children;
}
export function useLocalDirectory() {
  const snapshot = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => state,
    () => state,
  );
  return { ...localDirectory, ...snapshot };
}
export function isTransientReadError(error: unknown) {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String(error.code).replace('firestore/', '')
      : '';
  return [
    'unavailable',
    'deadline-exceeded',
    'network-request-failed',
  ].includes(code);
}
export function resetLocalDirectory() {
  state = {
    unavailableIds: [],
    favoriteIds: [],
    providers: [],
    categories: [],
    hydrated: false,
    storageError: null,
  };
  hydration = undefined;
  emit();
}

export function flushLocalDirectory() {
  return writes;
}
