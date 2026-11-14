import { useLocalDirectory } from '../local/LocalDirectory';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { db } from '../../lib/firebase/firestore';
import {
  fetchProvider,
  fetchCategoryProviders,
  fetchProviderTotal,
  type ProviderCursor,
} from '../provider/firebaseRepository';
export function usePublicProvider(id: string | undefined) {
  const local = useLocalDirectory();
  const cached = id ? local.getCachedProvider(id) : undefined;
  const result = useQuery({
    queryKey: ['public', 'provider', id],
    queryFn: () => fetchProvider(db!, id!),
    enabled: Boolean(db && id),
    staleTime: 5 * 60_000,
    refetchInterval: (query) => (query.state.data?.cachedAt ? 30_000 : false),
  });
  const data =
    id && local.unavailableIds.includes(id)
      ? null
      : result.data === undefined
        ? cached
        : result.data;
  return { ...result, data, isPending: result.isPending && !cached };
}
export function useCategoryProviders(id: string | undefined) {
  const local = useLocalDirectory();
  const cached = local
    .getCachedProviders()
    .filter((item) => item.categoryId === id);
  const pages = useInfiniteQuery({
    queryKey: ['public', 'category', id, 'pages'],
    initialPageParam: undefined as ProviderCursor,
    queryFn: ({ pageParam }) => fetchCategoryProviders(db!, id!, pageParam),
    getNextPageParam: (page) => page.nextCursor,
    refetchInterval: (query) =>
      query.state.data?.pages.some((page) =>
        page.items.some((item) => item.cachedAt),
      )
        ? 30_000
        : false,
    enabled: Boolean(db && id),
    staleTime: 5 * 60_000,
  });
  const count = useQuery({
    queryKey: ['public', 'category-total', id],
    queryFn: () => fetchProviderTotal(db!, id!),
    enabled: Boolean(db && id),
    staleTime: 60_000,
  });
  return {
    ...pages,
    isPending: pages.isPending && !cached.length,
    data: pages.data
      ? [
          ...new Map(
            pages.data.pages
              .flatMap((page) => page.items)
              .map((item) => [item.id, item]),
          ).values(),
        ]
      : cached.length
        ? cached
        : undefined,
    total: count.data,
    loadMore: () => pages.fetchNextPage({ cancelRefetch: false }),
    refetch: () => Promise.all([pages.refetch(), count.refetch()]),
  };
}
