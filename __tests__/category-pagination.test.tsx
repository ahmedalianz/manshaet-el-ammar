import { beforeEach, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { useCategoryProviders } from '../src/features/discovery/firebaseQueries';
import { useDirectorySearch } from '../src/features/discovery/DirectoryPagination';
import {
  fetchCategoryProviders,
  fetchProviderTotal,
  type ProviderCursor,
} from '../src/features/provider/firebaseRepository';
import { providers } from './fixtures/providers';
import { searchProviders } from '../src/features/discovery/search';
let mockFocused = true;
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused }));
jest.mock('../src/lib/firebase/firestore', () => ({ db: {} }));
jest.mock('../src/features/provider/firebaseRepository', () => ({
  fetchCategoryProviders: jest.fn(),
  fetchProviderTotal: jest.fn(),
}));
const fetch = jest.mocked(fetchCategoryProviders);
const count = jest.mocked(fetchProviderTotal);
beforeEach(() => {
  jest.resetAllMocks();
  mockFocused = true;
  count.mockResolvedValue(51);
});
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}
it('finds an older matching category service after the first 50 records', async () => {
  const cursor = { id: 'fiftieth' } as unknown as ProviderCursor;
  fetch
    .mockResolvedValueOnce({
      items: Array.from({ length: 50 }, (_, i) => ({
        ...providers[0],
        id: `recent-${i}`,
      })),
      nextCursor: cursor,
    })
    .mockResolvedValueOnce({
      items: [{ ...providers[0], id: 'older', name: 'الاسم القديم الفريد' }],
      nextCursor: undefined,
    });
  const { result, rerender } = await renderHook(
    ({ term }: { term: string }) => {
      const state = useCategoryProviders('plumbing');
      useDirectorySearch(term, {
        hasMore: state.hasNextPage,
        fetching: state.isFetching,
        error: state.error,
        loadMore: state.loadMore,
      });
      return state;
    },
    { wrapper: setup(), initialProps: { term: '' } },
  );
  await waitFor(() => expect(result.current.data).toHaveLength(50));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(result.current.total).toBe(51);
  await rerender({ term: 'الفريد' });
  await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  expect(
    searchProviders('الفريد', 'plumbing', result.current.data!).map(
      (item) => item.id,
    ),
  ).toEqual(['older']);
  expect(fetch).toHaveBeenLastCalledWith(expect.anything(), 'plumbing', cursor);
});
it('does not keep scanning after search is cleared while a page is in flight', async () => {
  const cursor = { id: 'first' } as unknown as ProviderCursor;
  const next = { id: 'second' } as unknown as ProviderCursor;
  let finish!: (
    page: Awaited<ReturnType<typeof fetchCategoryProviders>>,
  ) => void;
  fetch
    .mockResolvedValueOnce({ items: [providers[0]], nextCursor: cursor })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  const { result, rerender } = await renderHook(
    ({ term }: { term: string }) => {
      const state = useCategoryProviders('plumbing');
      useDirectorySearch(term, {
        hasMore: state.hasNextPage,
        fetching: state.isFetching,
        error: state.error,
        loadMore: state.loadMore,
      });
      return state;
    },
    { wrapper: setup(), initialProps: { term: '' } },
  );
  await waitFor(() => expect(result.current.data).toHaveLength(1));
  await rerender({ term: 'نجار' });
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  await rerender({ term: '' });
  await act(async () => {
    finish({ items: [{ ...providers[0], id: 'second' }], nextCursor: next });
  });
  await waitFor(() => expect(result.current.isFetching).toBe(false));
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(result.current.hasNextPage).toBe(true);
});

it('does not scan in an unfocused screen and resumes when focused', async () => {
  const cursor = { id: 'first' } as unknown as ProviderCursor;
  fetch
    .mockResolvedValueOnce({ items: [providers[0]], nextCursor: cursor })
    .mockResolvedValueOnce({ items: [], nextCursor: undefined });
  mockFocused = false;
  const { result, rerender } = await renderHook(
    ({ term }: { term: string }) => {
      const state = useCategoryProviders('plumbing');
      useDirectorySearch(term, {
        hasMore: state.hasNextPage,
        fetching: state.isFetching,
        error: state.error,
        loadMore: state.loadMore,
      });
      return state;
    },
    { wrapper: setup(), initialProps: { term: 'قديم' } },
  );
  await waitFor(() => expect(result.current.hasNextPage).toBe(true));
  expect(fetch).toHaveBeenCalledTimes(1);
  mockFocused = true;
  await rerender({ term: 'قديم' });
  await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  expect(fetch).toHaveBeenCalledTimes(2);
});
