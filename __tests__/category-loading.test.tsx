import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent } from './helpers/render';
import CategoryScreen from '../src/app/category/[id]';
import { providers } from './fixtures/providers';
import type { ServiceProvider } from '../src/features/discovery/types';
const mockQuery: {
  data: ServiceProvider[] | undefined;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: ReturnType<typeof jest.fn>;
} = {
  data: undefined,
  isPending: true,
  isFetching: true,
  isError: false,
  error: null,
  refetch: jest.fn(),
};
const mockState = {
  categories: [] as unknown[],
  configured: true,
  publicLoading: false,
  categoriesLoading: false,
  publicError: null,
};
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useLocalSearchParams: () => ({ id: 'plumbing' }),
  router: { back: jest.fn(), push: jest.fn() },
}));
jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: () => mockState,
}));
jest.mock('../src/features/discovery/firebaseQueries', () => ({
  useCategoryProviders: () => mockQuery,
}));
jest.mock('../src/features/discovery/components/ProviderCard', () => {
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ProviderCard: ({ provider }: { provider: ServiceProvider }) => (
      <Text>{provider.name}</Text>
    ),
  };
});
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));
beforeEach(() => {
  mockState.categories = jest.requireActual<
    typeof import('../src/features/discovery/data/categories')
  >('../src/features/discovery/data/categories').categories;
  mockState.publicLoading = false;
  mockState.categoriesLoading = false;
  Object.assign(mockQuery, {
    data: undefined,
    isPending: true,
    isFetching: true,
    isError: false,
    error: null,
  });
  mockQuery.refetch.mockClear();
});
describe('category loading lifecycle', () => {
  it('shows one progress state without premature empty results', async () => {
    await render(<CategoryScreen />);
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    expect(screen.queryByText('لسه مفيش خدمات في القسم ده')).toBeNull();
  });
  it('waits for category metadata instead of reporting a missing category', async () => {
    mockState.categories = [];
    mockState.categoriesLoading = true;
    await render(<CategoryScreen />);
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    expect(screen.queryByText('القسم غير موجود')).toBeNull();
  });
  it('keeps cached category rows visible during background refresh', async () => {
    mockQuery.data = [providers[0]];
    mockQuery.isPending = false;
    mockState.publicLoading = true; // unrelated public directory request
    await render(<CategoryScreen />);
    expect(screen.getByText(providers[0].name)).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
  it('shows an empty state only after the request succeeds', async () => {
    mockQuery.data = [];
    mockQuery.isPending = false;
    mockQuery.isFetching = false;
    await render(<CategoryScreen />);
    expect(screen.getByText('لسه مفيش خدمات في القسم ده')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
  it('retains cached rows on refresh errors and allows retry', async () => {
    mockQuery.data = [providers[0]];
    mockQuery.isPending = false;
    mockQuery.isFetching = false;
    mockQuery.isError = true;
    mockQuery.error = { code: 'unavailable' };
    await render(<CategoryScreen />);
    expect(screen.getByText(providers[0].name)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'جرّب تاني' }));
    expect(mockQuery.refetch).toHaveBeenCalledTimes(1);
  });
});
