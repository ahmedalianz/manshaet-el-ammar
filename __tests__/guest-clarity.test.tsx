import { afterEach, describe, expect, it, jest } from '@jest/globals';
import * as ReactNative from 'react-native';
import { router } from 'expo-router';
import { fireEvent, render, screen } from './helpers/render';
import Home from '../src/app/(tabs)/index';
import Explore from '../src/app/(tabs)/explore';
import { searchDirectory } from '../src/features/discovery/search';
import { categories } from '../src/features/discovery/data/categories';
import { providers } from './fixtures/providers';
import type { ServiceProvider } from '../src/features/discovery/types';

const originalWindow = ReactNative.Dimensions.get('window');
const originalScreen = ReactNative.Dimensions.get('screen');
let mockProviders: ServiceProvider[] = [providers[0]];
let mockUserId: string | undefined;
let mockHasMore = false;
let mockFetching = false;
let mockPublicError: string | undefined;
const mockLoadMore = jest
  .fn<() => Promise<void>>()
  .mockResolvedValue(undefined);
let mockDetail: ServiceProvider = providers[0];
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useFocusEffect: (callback: () => void) =>
    jest
      .requireActual<typeof import('react')>('react')
      .useEffect(callback, [callback]),
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: 'provider-plumbing-1' }),
}));
jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: () => ({
    userId: mockUserId,
    categories: jest.requireActual<
      typeof import('../src/features/discovery/data/categories')
    >('../src/features/discovery/data/categories').categories,
    publicProviders: mockProviders,
    configured: true,
    publicLoading: false,
    publicHasMore: mockHasMore,
    publicFetching: mockFetching,
    publicError: mockPublicError,
    loadMorePublicProviders: mockLoadMore,
  }),
}));
jest.mock('../src/features/discovery/firebaseQueries', () => ({
  usePublicProvider: () => ({ data: mockDetail, refetch: jest.fn() }),
}));
jest.mock('../src/features/discovery/useProviderContactActions', () => ({
  useProviderContactActions: () => ({ busy: false, performContact: jest.fn() }),
}));
jest.mock('../src/features/support/useSupportActions', () => ({
  useSupportActions: () => ({ openEmail: jest.fn() }),
}));
jest.mock('../src/components/ui/Feedback', () => ({
  useFeedback: () => ({ show: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));
afterEach(() => {
  jest.restoreAllMocks();
  ReactNative.Dimensions.set({
    window: originalWindow,
    screen: originalScreen,
  });
  mockProviders = [providers[0]];
  mockHasMore = false;
  mockFetching = false;
  mockPublicError = undefined;
  mockLoadMore.mockClear();
  mockUserId = undefined;
});

describe('guest discovery clarity', () => {
  it('keeps one location and a short search-first introduction', async () => {
    await render(<Home />);
    expect(screen.queryByText('أهلًا بيك في بلدك 👋')).toBeNull();
    expect(screen.queryByText('أهلنا وجيرانا سند لبعض')).toBeNull();
    expect(screen.queryByText('كل اللي محتاجه... قريب منك')).toBeNull();
    expect(screen.getByText('بتدور على إيه؟')).toBeTruthy();
    expect(screen.queryByText(/منشأة العمار، طوخ، القليوبية/)).toBeNull();
    expect(screen.queryByText('دليل خدمات البلد')).toBeNull();
    expect(screen.getByText('بلدنا أقرب')).toBeTruthy();
    expect(screen.queryByText('أرقام تهمك')).toBeNull();
    const links = screen.getAllByText('كل الأقسام');
    expect(links).toHaveLength(1);
    expect(screen.getByText('عرض الكل')).toBeTruthy();
    for (const link of links) {
      expect(ReactNative.StyleSheet.flatten(link.props.style).textAlign).toBe(
        'right',
      );
      await fireEvent.press(link);
      expect(router.push).toHaveBeenLastCalledWith({
        pathname: '/explore',
        params: { filter: 'all' },
      });
    }
  });

  it('names mixed result destinations without changing ranked order or query', async () => {
    await render(<Home />);
    const input = screen.getByLabelText('ابحث عن خدمة أو مقدم خدمة...');
    const query = '  سباك  ';
    await fireEvent.changeText(input, query);
    const expected = searchDirectory(query, mockProviders, categories).map(
      (result) =>
        result.type === 'provider'
          ? `مقدم خدمة: ${result.provider.name}، ${result.provider.serviceTitle}`
          : `قسم: ${result.category.name}`,
    );
    const rows = screen
      .getAllByRole('button')
      .filter((button) =>
        /^(مقدم خدمة|قسم):/.test(button.props.accessibilityLabel ?? ''),
      );
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual(expected);
    expect(screen.getByText('مقدم خدمة')).toBeTruthy();
    expect(screen.getByText('قسم')).toBeTruthy();
    await fireEvent.press(
      rows.find((row) =>
        row.props.accessibilityLabel.startsWith('مقدم خدمة:'),
      )!,
    );
    expect(jest.mocked(router.push).mock.calls.at(-1)?.[0]).toEqual({
      pathname: '/provider/[id]',
      params: { id: providers[0].id },
    });
    expect(input.props.value).toBe(query);
    await fireEvent.press(
      rows.find((row) => row.props.accessibilityLabel.startsWith('قسم:'))!,
    );
    expect(jest.mocked(router.push).mock.calls.at(-1)?.[0]).toEqual({
      pathname: '/category/[id]',
      params: { id: 'plumbing' },
    });
  });

  it('passes Home search text into Discover from either search shortcut', async () => {
    await render(<Home />);
    const query = '  سباك  ';
    await fireEvent.changeText(
      screen.getByLabelText('ابحث عن خدمة أو مقدم خدمة...'),
      query,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'عرض كل النتائج' }),
    );
    expect(router.push).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pathname: '/explore',
        params: expect.objectContaining({
          search: query,
          searchRequest: expect.any(String),
        }),
      }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'افتح نتائج البحث' }),
    );
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/explore',
      params: { search: query, searchRequest: expect.any(String) },
    });
    await fireEvent(
      screen.getByLabelText('ابحث عن خدمة أو مقدم خدمة...'),
      'submitEditing',
      { nativeEvent: { text: query } },
    );
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/explore',
      params: { search: query, searchRequest: expect.any(String) },
    });
  });

  it('uses the complete native text when keyboard submission precedes the last state update', async () => {
    await render(<Home />);
    const input = screen.getByLabelText('ابحث عن خدمة أو مقدم خدمة...');
    await fireEvent.changeText(input, 'A');
    await fireEvent(input, 'submitEditing', { nativeEvent: { text: 'Ahmed' } });
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/explore',
      params: { search: 'Ahmed', searchRequest: expect.any(String) },
    });
  });

  it('keeps long provider names and professions untruncated', async () => {
    const provider = {
      ...providers[0],
      name: 'الأسطى أحمد محمد عبد الرحمن لصيانة وتركيب الأدوات الصحية',
      serviceTitle:
        'سباك متخصص في صيانة المواسير والمضخات والأدوات الصحية المنزلية',
    };
    mockProviders = [provider];
    await render(<Home />);
    await fireEvent.changeText(
      screen.getByLabelText('ابحث عن خدمة أو مقدم خدمة...'),
      'سباك',
    );
    for (const value of [provider.name, provider.serviceTitle]) {
      const label = screen.getAllByText(value)[0];
      expect(label.props.numberOfLines).toBeUndefined();
      expect(label.props.allowFontScaling).not.toBe(false);
    }
  });

  it('has no empty type labels for category-only or zero results and clears normally', async () => {
    mockProviders = [];
    await render(<Home />);
    const input = screen.getByLabelText('ابحث عن خدمة أو مقدم خدمة...');
    await fireEvent.changeText(input, 'كهربائي');
    expect(screen.getByText('قسم')).toBeTruthy();
    expect(screen.queryByText('مقدم خدمة')).toBeNull();
    await fireEvent.changeText(input, 'zzzz-no-match');
    expect(screen.getByText('ملقيناش اللي بتدور عليه')).toBeTruthy();
    expect(screen.queryByText('قسم')).toBeNull();
    expect(screen.queryByText('مقدم خدمة')).toBeNull();
    await fireEvent.press(screen.getByLabelText('مسح البحث'));
    expect(input.props.value).toBe('');
  });

  it('describes Explore as a provider directory with compact category filters', async () => {
    await render(<Explore />);
    expect(screen.getByRole('header', { name: 'استكشف الخدمات' })).toBeTruthy();
    expect(
      screen.getByRole('header', { name: 'أصحاب الخدمات المتاحة' }),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'تصفية الأقسام' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'صحة وطب' }));
    expect(screen.getByText('أصحاب الخدمات المتاحة')).toBeTruthy();
  });
});

it.each([undefined, 'provider-account', 'admin-account'])(
  'keeps Home and profile navigation available for %s',
  async (userId) => {
    mockUserId = userId;
    await render(<Home />);
    expect(screen.getByText('بتدور على إيه؟')).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', {
        name: userId ? 'الملف الشخصي' : 'تسجيل الدخول',
      }),
    );
    expect(router.push).toHaveBeenLastCalledWith(
      userId ? '/account/profile' : '/provider/sign-in',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'استكشف كل الخدمات' }),
    );
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/explore',
      params: { filter: 'all' },
    });
  },
);
it('Home excludes pending, rejected and unpublished listings from its preview', async () => {
  mockProviders = [
    {
      ...providers[0],
      id: 'pending-record',
      name: 'اسم قيد المراجعة',
      status: 'pending',
    },
    {
      ...providers[0],
      id: 'rejected-record',
      name: 'اسم مرفوض',
      status: 'rejected',
    },
    {
      ...providers[0],
      id: 'unpublished-record',
      name: 'اسم غير منشور',
      publicationStatus: 'unpublished',
    },
    { ...providers[0], name: 'اسم منشور' },
  ];
  await render(<Home />);
  expect(screen.getByText('اسم منشور')).toBeTruthy();
  for (const name of ['اسم قيد المراجعة', 'اسم مرفوض', 'اسم غير منشور'])
    expect(screen.queryByText(name)).toBeNull();
});

it('opens full-directory results from Home without losing the typed query', async () => {
  await render(<Home />);
  const query = '  سباك  ';
  await fireEvent.changeText(
    screen.getByLabelText('ابحث عن خدمة أو مقدم خدمة...'),
    query,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'عرض كل النتائج' }));
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: '/explore',
    params: { search: query, searchRequest: expect.any(String) },
  });
});

it('focuses Home on search results and restores discovery after clearing', async () => {
  await render(<Home />);
  const input = screen.getByLabelText('ابحث عن خدمة أو مقدم خدمة...');
  await fireEvent.changeText(input, 'سباك');
  expect(screen.getByRole('button', { name: 'عرض كل النتائج' })).toBeTruthy();
  for (const text of [
    'استكشف الأقسام',
    'خدمات في بلدنا',
    'بلدنا أقرب.',
    'عندك خدمة أو محل في البلد؟',
  ])
    expect(screen.queryByText(text)).toBeNull();
  expect(screen.queryByText(/عرض حتى ٦ اقتراحات/)).toBeNull();
  expect(screen.queryByText(/تم تحميل/)).toBeNull();
  await fireEvent.press(screen.getByLabelText('مسح البحث'));
  expect(screen.getByText('استكشف الأقسام')).toBeTruthy();
  expect(screen.getByText('خدمات في بلدنا')).toBeTruthy();
});

it('offers working suggestions and a way home when search has no matches', async () => {
  await render(<Home />);
  await fireEvent.changeText(
    screen.getByLabelText('ابحث عن خدمة أو مقدم خدمة...'),
    'zzzz-no-match',
  );
  expect(
    screen.getByRole('header', { name: 'ملقيناش اللي بتدور عليه' }),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'عرض كل النتائج' })).toBeNull();
  expect(screen.queryByText('استكشف الأقسام')).toBeNull();
  await fireEvent.press(
    screen.getByRole('button', {
      name: `ابحث عن ${categories.find((c) => c.id === 'plumbing')!.name}`,
    }),
  );
  expect(screen.getByText('مقدم خدمة')).toBeTruthy();
  await fireEvent.changeText(
    screen.getByLabelText('ابحث عن خدمة أو مقدم خدمة...'),
    'zzzz-no-match',
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'امسح البحث وارجع للرئيسية' }),
  );
  expect(screen.getByText('استكشف الأقسام')).toBeTruthy();
});

it('does not announce no matches while the directory search is incomplete', async () => {
  mockHasMore = true;
  mockFetching = true;
  await render(<Home />);
  await fireEvent.changeText(
    screen.getByLabelText('ابحث عن خدمة أو مقدم خدمة...'),
    'zzzz-no-match',
  );
  expect(screen.queryByText('ملقيناش اللي بتدور عليه')).toBeNull();
  expect(screen.getByText('بندور في باقي الخدمات…')).toBeTruthy();
});

it('offers a retry instead of a false empty state after a failed search', async () => {
  mockHasMore = true;
  mockPublicError = 'offline';
  await render(<Home />);
  await fireEvent.changeText(
    screen.getByLabelText('ابحث عن خدمة أو مقدم خدمة...'),
    'zzzz-no-match',
  );
  expect(screen.queryByText('ملقيناش اللي بتدور عليه')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'جرّب تاني' }));
  expect(mockLoadMore).toHaveBeenCalledTimes(1);
});

it('compacts the Home header after scrolling and restores it near the top', async () => {
  await render(<Home />);
  const scroll = screen.getByTestId('home-scroll');
  expect(screen.getByText('بلدنا أقرب')).toBeTruthy();
  await fireEvent.scroll(scroll, {
    nativeEvent: { contentOffset: { x: 0, y: 80 } },
  });
  expect(screen.queryByText('بلدنا أقرب')).toBeNull();
  expect(screen.getByRole('button', { name: 'تسجيل الدخول' })).toBeTruthy();
  await fireEvent.scroll(scroll, {
    nativeEvent: { contentOffset: { x: 0, y: 32 } },
  });
  expect(screen.queryByText('بلدنا أقرب')).toBeNull();
  await fireEvent.scroll(scroll, {
    nativeEvent: { contentOffset: { x: 0, y: 16 } },
  });
  expect(screen.getByText('بلدنا أقرب')).toBeTruthy();
});
