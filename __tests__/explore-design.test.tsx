import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from './helpers/render';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import Explore from '../src/app/(tabs)/explore';
import type { ServiceProvider } from '../src/features/discovery/types';
import { categories } from '../src/features/discovery/data/categories';
import { providers } from './fixtures/providers';
let mockFilter: string | undefined;
let mockSearch: string | undefined;
const mockState = {
  categories,
  publicProviders: providers,
  publicLoading: false,
  configured: true,
  userId: null,
  initializing: false,
  publicHasMore: false,
  publicFetching: false,
  publicError: null as string | null,
  loadMorePublicProviders: jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined),
};
jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: () => mockState,
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
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useFocusEffect: (callback: () => void) =>
    jest
      .requireActual<typeof import('react')>('react')
      .useEffect(callback, [callback]),
  useLocalSearchParams: () => ({ filter: mockFilter, search: mockSearch }),
  router: { push: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));
const inputLabel = 'ابحث عن خدمة أو مقدم خدمة...';
beforeEach(() => {
  jest.clearAllMocks();
  mockState.publicLoading = false;
  mockState.publicProviders = providers;
  mockState.publicHasMore = false;
  mockState.publicFetching = false;
  mockState.publicError = null;
  mockFilter = undefined;
  mockSearch = undefined;
});
describe('Stitch Discover design', () => {
  it('shows the provider directory and filters by category in place', async () => {
    await render(<Explore />);
    await fireEvent.press(
      screen.getByRole('button', { name: categories[1].name }),
    );
    expect(screen.getByText(providers[3].name)).toBeTruthy();
    expect(screen.queryByText(providers[0].name)).toBeNull();
  });
  it('offers service-type filtering without the removed area filter', async () => {
    await render(<Explore />);
    await fireEvent.press(
      screen.getByRole('button', { name: 'تصفية الأقسام' }),
    );
    expect(screen.queryByText('المنطقة')).toBeNull();
    expect(screen.queryByRole('button', { name: 'داير الناحية' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'صحة وطب' }));
    expect(screen.getByText(providers[4].name)).toBeTruthy();
    expect(screen.queryByText(providers[0].name)).toBeNull();
  });
  it('finds real providers by name without adding fabricated ratings', async () => {
    await render(<Explore />);
    await fireEvent.changeText(screen.getByLabelText(inputLabel), 'أحمد');
    expect(screen.getByText('أصحاب الخدمات المتاحة')).toBeTruthy();
    expect(screen.getByText(providers[0].name)).toBeTruthy();
    expect(screen.queryByText(/تم تحميل/)).toBeNull();
    expect(screen.queryByText(/في الدليل بالكامل/)).toBeNull();
    expect(screen.queryByText('ملقتش الخدمة اللي محتاجها؟')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'تواصل مع مشرفي الدليل' }),
    ).toBeNull();
    expect(screen.queryByText('معتمد')).toBeNull();
  });
  it('shows a contextual empty state and clears active filters', async () => {
    await render(<Explore />);
    await fireEvent.press(
      screen.getByRole('button', { name: categories[1].name }),
    );
    await fireEvent.changeText(
      screen.getByLabelText(inputLabel),
      'zz-no-results',
    );
    expect(screen.getByText('ملقيناش خدمات مطابقة لبحثك')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'مسح الفلاتر' }));
    expect(screen.getByLabelText(inputLabel).props.value).toBe('');
    expect(screen.getByText(providers[0].name)).toBeTruthy();
  });
  it('keeps one centered loading state instead of premature empty results', async () => {
    mockState.publicLoading = true;
    await render(<Explore />);
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    expect(screen.queryByText('مفيش نتائج مطابقة')).toBeNull();
  });
  it('keeps the support action available to guests in the empty state', async () => {
    mockState.publicProviders = [];
    await render(<Explore />);
    await fireEvent.press(
      screen.getByRole('button', { name: 'تواصل مع مشرفي الدليل' }),
    );
    expect(router.push).toHaveBeenCalledWith('/info/contact');
  });
});

it('keeps legacy group filter links working in an already mounted Explore tab', async () => {
  mockFilter = 'health';
  const view = await render(<Explore />);
  expect(screen.getByText(providers[4].name)).toBeTruthy();
  expect(screen.queryByText(providers[0].name)).toBeNull();
  await fireEvent.changeText(screen.getByLabelText(inputLabel), 'أحمد');
  mockFilter = 'transport';
  await view.rerender(<Explore />);
  expect(screen.getByLabelText(inputLabel).props.value).toBe('');
  expect(screen.getByText('مواصلات ونقل')).toBeTruthy();
  expect(screen.queryByText(providers[0].name)).toBeNull();
  expect(screen.queryByText(providers[4].name)).toBeNull();
});

it('includes public search matches even when their category metadata is not loaded', async () => {
  const previous = mockState.publicProviders;
  try {
    mockState.publicProviders = [
      {
        ...providers[0],
        categoryId: 'unloaded-category',
        name: 'خدمة قديمة مميزة',
      },
    ];
    await render(<Explore />);
    await fireEvent.changeText(screen.getByLabelText(inputLabel), 'قديمة');
    expect(screen.getByText('خدمة قديمة مميزة')).toBeTruthy();
  } finally {
    mockState.publicProviders = previous;
  }
});

it('gives a filtered empty state a working route back to all services', async () => {
  await render(<Explore />);
  await fireEvent.changeText(
    screen.getByLabelText(inputLabel),
    'zz-no-results',
  );
  expect(
    screen.getByText('جرّب اسم أقصر أو نوع الخدمة، أو وسّع البحث لكل الأقسام.'),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'شوف كل الخدمات' }));
  expect(screen.getByLabelText(inputLabel).props.value).toBe('');
  expect(screen.getByText(providers[0].name)).toBeTruthy();
  expect(screen.queryByText('ملقيناش خدمات مطابقة لبحثك')).toBeNull();
});

it('shows an honest empty directory without a redundant clear-filters action', async () => {
  mockState.publicProviders = [];
  await render(<Explore />);
  expect(
    screen.getByRole('header', { name: 'لسه مفيش خدمات منشورة' }),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'شوف كل الخدمات' })).toBeNull();
  expect(screen.queryByText(/تم تحميل/)).toBeNull();
});

it('keeps pagination usable without the verbose footer', async () => {
  mockState.publicHasMore = true;
  await render(<Explore />);
  await fireEvent.press(
    screen.getByRole('button', { name: 'تحميل خدمات أكتر' }),
  );
  expect(mockState.loadMorePublicProviders).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/إجمالي الدليل/)).toBeNull();
});

it('waits for remaining pages instead of showing an empty result too soon', async () => {
  mockState.publicHasMore = true;
  mockState.publicFetching = true;
  await render(<Explore />);
  await fireEvent.changeText(
    screen.getByLabelText(inputLabel),
    'zz-no-results',
  );
  expect(screen.queryByText('ملقيناش خدمات مطابقة لبحثك')).toBeNull();
  expect(screen.getByText('بندور في باقي الخدمات…')).toBeTruthy();
});

it.each(['empty-directory', 'empty-search', 'empty-category'] as const)(
  'keeps stable scroll space for %s while the header compacts',
  async (state) => {
    if (state === 'empty-directory') mockState.publicProviders = [];
    if (state === 'empty-category') mockFilter = 'education';
    await render(<Explore />);
    if (state === 'empty-search')
      await fireEvent.changeText(
        screen.getByLabelText(inputLabel),
        'zz-no-results',
      );
    await fireEvent(screen.getByTestId('discover-screen'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 720 } },
    });
    const contentStyle = () =>
      StyleSheet.flatten(
        screen.getByTestId('discover-list').props.contentContainerStyle,
      );
    expect(contentStyle()).toEqual(
      expect.objectContaining({ minHeight: 720, paddingBottom: 80 }),
    );
    await fireEvent.scroll(screen.getByTestId('discover-list'), {
      nativeEvent: { contentOffset: { x: 0, y: 80 } },
    });
    expect(contentStyle().minHeight).toBe(720);
    if (state !== 'empty-directory') {
      await fireEvent.press(
        screen.getByRole('button', { name: 'مسح الفلاتر' }),
      );
      expect(contentStyle().minHeight).toBeUndefined();
      expect(contentStyle().paddingBottom).toBe(32);
    }
  },
);
