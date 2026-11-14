import { useDirectorySearch } from '../src/features/discovery/DirectoryPagination';
import type { ProviderCursor } from '../src/features/provider/firebaseRepository';
import { searchProviders } from '../src/features/discovery/search';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import {
  ProviderStateProvider,
  useProviderState,
} from '../src/features/provider/ProviderContext';
import * as adminRepository from '../src/features/provider/firebaseAdminRepository';
import * as repository from '../src/features/provider/firebaseRepository';
import { auth } from '../src/lib/firebase/auth';
import type {
  ProviderListing,
  ServiceRequest,
  ServiceValues,
} from '../src/features/provider/types';
jest.mock('expo-router', () => ({ useIsFocused: () => true }));

const mockAuth: {
  user: { uid: string; displayName: string; email: string } | null;
  initializing: boolean;
  configured: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
} = {
  user: null,
  initializing: false,
  configured: true,
  isAdmin: false,
  signOut: async () => {
    mockAuth.user = null;
  },
};
jest.mock('../src/features/auth/AuthProvider', () => ({
  useAuth: () => mockAuth,
}));
jest.mock('../src/lib/firebase/auth', () => ({
  auth: { currentUser: { uid: 'user-a' } },
}));
jest.mock('../src/features/provider/firebaseAdminRepository', () => ({
  fetchModeration: jest.fn(),
  reviewRequest: jest.fn(),
  unpublishProvider: jest.fn(),
  restoreProvider: jest.fn(),
  deleteProvider: jest.fn(),
  resolveReport: jest.fn(),
}));
jest.mock('../src/lib/firebase/firestore', () => ({ db: {} }));
jest.mock('../src/features/provider/firebaseRepository', () => ({
  fetchCategories: jest.fn(),
  fetchPublicProviders: jest.fn(),
  fetchProviderTotal: jest.fn(),
  fetchMyProviders: jest.fn(),
  fetchMyRequests: jest.fn(),
  fetchProfile: jest.fn(),
  submitRequest: jest.fn(),
  updateProfile: jest.fn(),
}));
const repo = jest.mocked(repository);
const values: ServiceValues = {
  name: 'صاحب الخدمة',
  categoryId: 'plumbing',
  serviceTitle: 'سباك',
  description: '',
  phone: '01012345678',

  address: 'شارع المدارس',
};
function provider(id: string, ownerId = 'user-a'): ProviderListing {
  return {
    ...values,
    id,
    ownerId,
    status: 'approved',
    publicationStatus: 'published',
  };
}
function request(
  id: string,
  providerId: string,
  status: ServiceRequest['status'],
  type: ServiceRequest['type'] = 'create',
): ServiceRequest {
  return {
    id,
    providerId,
    ownerId: 'user-a',
    type,
    status,
    proposedData: { ...values, serviceTitle: `تعديل ${id}` },
    createdAt: '2026-11-04T12:00:00.000Z',
    ...(status === 'rejected' ? { rejectionReason: 'راجع البيانات' } : {}),
  };
}
function session(uid: string) {
  mockAuth.user = { uid, displayName: uid, email: `${uid}@example.test` };
  if (auth?.currentUser) Object.assign(auth.currentUser, { uid });
}
function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ProviderStateProvider>{children}</ProviderStateProvider>
    </QueryClientProvider>
  );
  return { client, wrapper };
}
beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.user = null;
  mockAuth.initializing = false;
  mockAuth.isAdmin = false;
  repo.fetchCategories.mockResolvedValue([]);
  repo.fetchPublicProviders.mockResolvedValue({
    items: [],
    nextCursor: undefined,
  });
  repo.fetchProviderTotal.mockResolvedValue(0);
  repo.fetchMyProviders.mockResolvedValue([]);
  repo.fetchMyRequests.mockResolvedValue([]);
  repo.fetchProfile.mockResolvedValue(null);
  repo.submitRequest.mockResolvedValue('created-provider');
  repo.updateProfile.mockResolvedValue(undefined);
});
describe('production Firebase ProviderContext adapter', () => {
  it('does not issue private queries for guests', async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(useProviderState, { wrapper });
    await waitFor(() => expect(result.current.publicLoading).toBe(false));
    expect(result.current.role).toBe('guest');
    expect(result.current.listings).toEqual([]);
    expect(repo.fetchMyProviders).not.toHaveBeenCalled();
    expect(repo.fetchMyRequests).not.toHaveBeenCalled();
    expect(repo.fetchProfile).not.toHaveBeenCalled();
  });
  it('isolates UID caches on account switch and removes them on signout', async () => {
    session('user-a');
    repo.fetchMyProviders.mockImplementation(async (_db, uid) => [
      provider(`service-${uid}`, uid),
    ]);
    const { client, wrapper } = setup();
    const { result, rerender } = await renderHook(useProviderState, {
      wrapper,
    });
    await waitFor(() =>
      expect(result.current.listings[0]?.id).toBe('service-user-a'),
    );
    session('user-b');
    await rerender(undefined);
    expect(
      result.current.listings.some((item) => item.ownerId === 'user-a'),
    ).toBe(false);
    await waitFor(() =>
      expect(result.current.listings[0]?.id).toBe('service-user-b'),
    );
    expect(client.getQueriesData({ queryKey: ['private', 'user-a'] })).toEqual(
      [],
    );
    await act(async () => result.current.signOut());
    await rerender(undefined);
    expect(result.current.role).toBe('guest');
    expect(result.current.account).toBeUndefined();
    expect(result.current.listings).toEqual([]);
    expect(result.current.requests).toEqual([]);
    expect(client.getQueriesData({ queryKey: ['private', 'user-b'] })).toEqual(
      [],
    );
  });
  it('does not expose private results while authentication initializes', async () => {
    session('user-a');
    mockAuth.initializing = true;
    const { wrapper } = setup();
    const { result } = await renderHook(useProviderState, { wrapper });
    await waitFor(() => expect(result.current.publicLoading).toBe(false));
    expect(result.current.listings).toEqual([]);
    expect(result.current.requests).toEqual([]);
    expect(repo.fetchMyProviders).not.toHaveBeenCalled();
    expect(repo.fetchProfile).not.toHaveBeenCalled();
  });

  it('ignores an old account query that finishes after account switching', async () => {
    session('user-a');
    let finishOldQuery: (records: ProviderListing[]) => void = () => {
      throw new Error('Old query did not start');
    };
    const oldResult = new Promise<ProviderListing[]>((resolve) => {
      finishOldQuery = resolve;
    });
    repo.fetchMyProviders.mockImplementation(async (_db, uid) =>
      uid === 'user-a' ? oldResult : [provider('service-user-b', uid)],
    );
    const { client, wrapper } = setup();
    const { result, rerender } = await renderHook(useProviderState, {
      wrapper,
    });
    await waitFor(() => expect(repo.fetchMyProviders).toHaveBeenCalled());
    session('user-b');
    await rerender(undefined);
    await waitFor(() =>
      expect(result.current.listings[0]?.id).toBe('service-user-b'),
    );
    await act(async () => {
      finishOldQuery([provider('private-old-account')]);
      await oldResult;
    });
    expect(result.current.listings.map((item) => item.id)).toEqual([
      'service-user-b',
    ]);
    expect(client.getQueriesData({ queryKey: ['private', 'user-a'] })).toEqual(
      [],
    );
  });
  it('combines published services and request history without publishing proposed values', async () => {
    session('user-a');
    repo.fetchMyProviders.mockResolvedValue([
      provider('published'),
      provider('rejected-edit'),
    ]);
    repo.fetchMyRequests.mockResolvedValue([
      request('pending-edit', 'published', 'pending', 'update'),
      request('bad-edit', 'rejected-edit', 'rejected', 'update'),
      request('new', 'pending-only', 'pending'),
      request('rejected', 'rejected-only', 'rejected'),
      request('historical-approved', 'removed', 'approved'),
    ]);
    repo.fetchPublicProviders.mockResolvedValue({
      items: [provider('published')],
      nextCursor: undefined,
    });
    const { wrapper } = setup();
    const { result } = await renderHook(useProviderState, { wrapper });
    await waitFor(() => expect(result.current.privateLoading).toBe(false));
    expect(result.current.listings).toHaveLength(5);
    expect(
      result.current.listings.find((item) => item.id === 'published'),
    ).toMatchObject({
      serviceTitle: 'سباك',
      pendingChanges: { serviceTitle: 'تعديل pending-edit' },
    });
    expect(
      result.current.listings.find((item) => item.id === 'rejected-edit'),
    ).toMatchObject({
      status: 'approved',
      serviceTitle: 'سباك',
      editRejectionReason: 'راجع البيانات',
    });
    expect(
      result.current.listings.find((item) => item.id === 'pending-only')
        ?.status,
    ).toBe('pending');
    expect(
      result.current.listings.find((item) => item.id === 'rejected-only')
        ?.status,
    ).toBe('rejected');
    expect(
      result.current.listings.find((item) => item.id === 'removed')
        ?.publicationStatus,
    ).toBe('unpublished');
    expect(result.current.publicProviders).toHaveLength(1);
    expect(result.current.publicProviders[0].serviceTitle).toBe('سباك');
  });
  it('surfaces public/private query errors in Arabic without fixture fallback', async () => {
    session('user-a');
    repo.fetchPublicProviders.mockRejectedValue({ code: 'unavailable' });
    repo.fetchMyRequests.mockRejectedValue({ code: 'permission-denied' });
    const { wrapper } = setup();
    const { result } = await renderHook(useProviderState, { wrapper });
    await waitFor(() =>
      expect(result.current.publicError).toContain('الاتصال'),
    );
    await waitFor(() =>
      expect(result.current.privateError).toContain('مش مسموح'),
    );
    expect(result.current.publicProviders).toEqual([]);
    expect(result.current.listings).toEqual([]);
  });
  it('propagates submission errors and refuses changed Firebase sessions before writing', async () => {
    session('user-a');
    repo.submitRequest.mockRejectedValue(
      new Error('في طلب قيد المراجعة بالفعل.'),
    );
    const { wrapper } = setup();
    const { result } = await renderHook(useProviderState, { wrapper });
    await waitFor(() => expect(result.current.privateLoading).toBe(false));
    await expect(
      result.current.submit(values, undefined, false, true, 'submission'),
    ).rejects.toThrow('قيد المراجعة');
    expect(repo.submitRequest).toHaveBeenCalledWith(
      expect.anything(),
      'user-a',
      values,
      undefined,
      'submission',
      true,
    );
    if (auth?.currentUser) Object.assign(auth.currentUser, { uid: 'user-b' });
    await expect(
      result.current.submit(values, undefined, false, true, 'submission'),
    ).rejects.toThrow('الجلسة اتغيرت');
    expect(repo.submitRequest).toHaveBeenCalledTimes(1);
  });
});

describe('Firebase admin moderation', () => {
  it('loads all pending submissions only for claimed admins and awaits publication', async () => {
    session('user-a');
    mockAuth.isAdmin = true;
    jest.mocked(adminRepository.fetchModeration).mockResolvedValue({
      requests: [request('foreign-request', 'foreign-provider', 'pending')],
      services: [],
      reports: [],
    });
    jest.mocked(adminRepository.reviewRequest).mockResolvedValue(undefined);
    const { wrapper } = setup();
    const { result } = await renderHook(useProviderState, { wrapper });
    await waitFor(() => expect(result.current.pendingRequests).toHaveLength(1));
    expect(result.current.moderationEnabled).toBe(true);
    await act(async () => {
      await result.current.approveRequest('foreign-request');
    });
    expect(adminRepository.reviewRequest).toHaveBeenCalledWith(
      expect.anything(),
      'user-a',
      'foreign-request',
      'approved',
    );
  });
  it('never loads moderation or permits actions for providers', async () => {
    session('user-a');
    const { wrapper } = setup();
    const { result } = await renderHook(useProviderState, { wrapper });
    await waitFor(() => expect(result.current.privateLoading).toBe(false));
    expect(adminRepository.fetchModeration).not.toHaveBeenCalled();
    expect(result.current.services).toEqual([]);
    await expect(result.current.approveRequest('foreign')).rejects.toThrow(
      'لمشرف الدليل',
    );
    await expect(result.current.deleteService('foreign')).rejects.toThrow(
      'لمشرف الدليل',
    );
    expect(adminRepository.deleteProvider).not.toHaveBeenCalled();
  });
});

it('searches beyond the first 100 providers and stops scanning when cleared', async () => {
  const cursor = { id: 'cursor-100' } as unknown as ProviderCursor;
  const first = Array.from({ length: 100 }, (_, i) => provider(`recent-${i}`));
  repo.fetchPublicProviders
    .mockResolvedValueOnce({ items: first, nextCursor: cursor })
    .mockResolvedValueOnce({
      items: [{ ...provider('older-match'), name: 'خدمة قديمة فريدة' }],
      nextCursor: undefined,
    });
  repo.fetchProviderTotal.mockResolvedValue(101);
  const { wrapper } = setup();
  const { result, rerender } = await renderHook(
    ({ term }: { term: string }) => {
      const state = useProviderState();
      useDirectorySearch(term, {
        hasMore: state.publicHasMore,
        fetching: state.publicFetching,
        error: state.publicError,
        loadMore: state.loadMorePublicProviders,
      });
      return state;
    },
    { wrapper, initialProps: { term: '' } },
  );
  await waitFor(() => expect(result.current.publicProviders).toHaveLength(100));
  expect(repo.fetchPublicProviders).toHaveBeenCalledTimes(1);
  expect(result.current.publicHasMore).toBe(true);
  expect(result.current.publicTotal).toBe(101);
  await rerender({ term: 'فريدة' });
  await waitFor(() => expect(result.current.publicHasMore).toBe(false));
  expect(
    searchProviders('فريدة', undefined, result.current.publicProviders).map(
      (item) => item.id,
    ),
  ).toEqual(['older-match']);
  expect(repo.fetchPublicProviders).toHaveBeenLastCalledWith(
    expect.anything(),
    cursor,
  );
  await rerender({ term: '' });
  expect(result.current.publicProviders).toHaveLength(101);
});
it('preserves prior pages on failure and retries the same cursor without duplicates', async () => {
  const cursor = { id: 'last-doc' } as unknown as ProviderCursor;
  repo.fetchPublicProviders
    .mockResolvedValueOnce({ items: [provider('first')], nextCursor: cursor })
    .mockRejectedValueOnce({ code: 'unavailable' })
    .mockResolvedValueOnce({
      items: [provider('first'), provider('older')],
      nextCursor: undefined,
    });
  const { wrapper } = setup();
  const { result } = await renderHook(useProviderState, { wrapper });
  await waitFor(() => expect(result.current.publicHasMore).toBe(true));
  await act(async () => {
    await result.current.loadMorePublicProviders();
  });
  await waitFor(() => expect(result.current.publicError).toBeTruthy());
  expect(result.current.publicProviders.map((item) => item.id)).toEqual([
    'first',
  ]);
  await act(async () => {
    await result.current.loadMorePublicProviders();
  });
  await waitFor(() => expect(result.current.publicHasMore).toBe(false));
  expect(result.current.publicProviders.map((item) => item.id)).toEqual([
    'first',
    'older',
  ]);
  expect(
    repo.fetchPublicProviders.mock.calls.slice(-2).map((call) => call[1]),
  ).toEqual([cursor, cursor]);
});

it('derives an unpublished owner card from the archive and latest rejected correction without changing public data', async () => {
  session('user-a');
  repo.fetchMyProviders.mockResolvedValue([
    {
      ...provider('hidden'),
      publicationStatus: 'unpublished',
      unpublishReason: 'راجع الرقم',
    },
  ]);
  repo.fetchMyRequests.mockResolvedValue([
    {
      ...request('correction', 'hidden', 'rejected', 'restore'),
      proposedData: { ...values, serviceTitle: 'تصحيح محفوظ' },
      rejectionReason: 'وضّح العنوان',
    },
  ]);
  const { wrapper } = setup();
  const { result } = await renderHook(useProviderState, { wrapper });
  await waitFor(() => expect(result.current.privateLoading).toBe(false));
  expect(result.current.listings[0]).toMatchObject({
    id: 'hidden',
    publicationStatus: 'unpublished',
    status: 'rejected',
    unpublishReason: 'راجع الرقم',
    serviceTitle: 'تصحيح محفوظ',
    rejectionReason: 'وضّح العنوان',
  });
  expect(result.current.publicProviders).toEqual([]);
});

it('refreshes only the current owner listings and requests for My Services', async () => {
  session('user-a');
  const { wrapper } = setup();
  const { result } = await renderHook(useProviderState, { wrapper });
  await waitFor(() =>
    expect(result.current.privateLoading || result.current.publicLoading).toBe(
      false,
    ),
  );
  repo.fetchMyProviders.mockClear();
  repo.fetchMyRequests.mockClear();
  repo.fetchPublicProviders.mockClear();
  jest.mocked(adminRepository.fetchModeration).mockClear();
  await act(async () => {
    await result.current.refreshMyServices();
  });
  expect(repo.fetchMyProviders).toHaveBeenCalledTimes(1);
  expect(repo.fetchMyProviders).toHaveBeenCalledWith(
    expect.anything(),
    'user-a',
  );
  expect(repo.fetchMyRequests).toHaveBeenCalledTimes(1);
  expect(repo.fetchPublicProviders).not.toHaveBeenCalled();
  expect(adminRepository.fetchModeration).not.toHaveBeenCalled();
});
