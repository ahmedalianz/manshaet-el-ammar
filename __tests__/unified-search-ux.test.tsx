import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Keyboard, Text } from 'react-native';
import { router } from 'expo-router';
import Home from '../src/app/(tabs)/index';
import Explore from '../src/app/(tabs)/explore';
import { SearchInput } from '../src/features/discovery/components/DiscoveryUi';
import { categories } from '../src/features/discovery/data/categories';
import { searchProviders } from '../src/features/discovery/search';
import type { ServiceProvider } from '../src/features/discovery/types';
import { providers } from './fixtures/providers';
import { fireEvent, render, screen } from './helpers/render';

const mockState = {
  userId: null as string | null,
  initializing: false,
  configured: true,
  publicLoading: false,
  publicHasMore: false,
  publicFetching: false,
  publicError: null as string | null,
  categories,
  publicProviders: providers,
  loadMorePublicProviders: jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined),
};

jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useFocusEffect: (callback: () => void) =>
    jest
      .requireActual<typeof import('react')>('react')
      .useEffect(callback, [callback]),
  useLocalSearchParams: () => ({}),
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));

jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: () => mockState,
}));

jest.mock('../src/features/discovery/components/ProviderCard', () => {
  const { Text: TextActual } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ProviderCard: ({ provider }: { provider: ServiceProvider }) => (
      <TextActual>{provider.name}</TextActual>
    ),
  };
});

const inputLabel = 'ابحث عن خدمة أو مقدم خدمة...';

beforeEach(() => {
  jest.clearAllMocks();
  mockState.publicLoading = false;
  mockState.publicHasMore = false;
  mockState.publicFetching = false;
  mockState.publicError = null;
  mockState.publicProviders = providers;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Unified search ranking and input behavior', () => {
  it('ranks searchProviders identically to searchDirectory and matches new resident synonyms', () => {
    const base = providers[0];
    const broad: ServiceProvider = {
      ...base,
      id: 'broad',
      name: 'حسن علي',
      serviceTitle: 'أعمال منزلية',
      description: 'خبرة في السباكة والتوصيل',
    };
    const prefix: ServiceProvider = {
      ...base,
      id: 'prefix',
      name: 'السيد محمود',
      serviceTitle: 'صيانة سريعة وأعمال إضافية',
      description: '',
    };
    const exact: ServiceProvider = {
      ...base,
      id: 'exact',
      name: 'علي حسن',
      serviceTitle: 'صيانة سريعة',
      description: '',
    };

    expect(
      searchProviders('صيانة سريعة', undefined, [broad, prefix, exact]).map(
        (item) => item.id,
      ),
    ).toEqual(['exact', 'prefix']);

    expect(
      searchProviders('تأسيس', undefined, [
        {
          ...base,
          id: 'desc',
          name: 'سعد',
          serviceTitle: 'فني',
          description: 'تأسيس كامل',
        },
        {
          ...base,
          id: 'pref',
          name: 'تأسيس حديث',
          serviceTitle: 'فني',
          description: '',
        },
        {
          ...base,
          id: 'ex',
          name: 'تأسيس',
          serviceTitle: 'فني',
          description: '',
        },
      ]).map((item) => item.id),
    ).toEqual(['ex', 'pref', 'desc']);

    const pharmacy: ServiceProvider = {
      ...base,
      id: 'ph-1',
      categoryId: 'pharmacies',
      name: 'أمل الدواء',
      serviceTitle: 'رعاية صحية',
      description: '',
    };
    const tailor: ServiceProvider = {
      ...base,
      id: 'tl-1',
      categoryId: 'tailoring',
      name: 'كريم',
      serviceTitle: 'تعديل قصات',
      description: '',
    };
    const laundry: ServiceProvider = {
      ...base,
      id: 'ln-1',
      categoryId: 'laundry',
      name: 'النور',
      serviceTitle: 'تنظيف سريع',
      description: '',
    };

    expect(
      searchProviders('صيدلية', undefined, [pharmacy, tailor, laundry]).map(
        (item) => item.id,
      ),
    ).toEqual(['ph-1']);
    expect(
      searchProviders('ترزي', undefined, [pharmacy, tailor, laundry]).map(
        (item) => item.id,
      ),
    ).toEqual(['tl-1']);
    expect(
      searchProviders('مكوجي', undefined, [pharmacy, tailor, laundry]).map(
        (item) => item.id,
      ),
    ).toEqual(['ln-1']);
  });

  it('places clear button before trailing accessory and dismisses keyboard on submit', async () => {
    const dismissSpy = jest
      .spyOn(Keyboard, 'dismiss')
      .mockImplementation(() => {});

    const { toJSON } = await render(
      <SearchInput
        value="سباك"
        onChangeText={jest.fn()}
        placeholder="ابحث..."
        accessory={<Text>فلترة</Text>}
      />,
    );

    const serialized = JSON.stringify(toJSON());
    expect(serialized.indexOf('مسح البحث')).toBeGreaterThan(-1);
    expect(serialized.indexOf('فلترة')).toBeGreaterThan(
      serialized.indexOf('مسح البحث'),
    );

    await fireEvent(screen.getByLabelText('ابحث...'), 'submitEditing', {
      nativeEvent: { text: 'سباك' },
    });
    expect(dismissSpy).toHaveBeenCalledTimes(1);
  });
});

describe('Unified Not Found UX across Home and Discover', () => {
  it('offers illustrated not-found recovery, suggestions, and support action on Home', async () => {
    await render(<Home />);

    await fireEvent.changeText(screen.getByLabelText(inputLabel), 'zz-missing');
    expect(
      screen.getByRole('header', { name: 'ملقيناش اللي بتدور عليه' }),
    ).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', { name: 'تواصل مع مشرفي الدليل' }),
    );
    expect(router.push).toHaveBeenCalledWith('/info/contact');

    await fireEvent.press(
      screen.getByRole('button', {
        name: `ابحث عن ${categories.find((item) => item.id === 'plumbing')!.name}`,
      }),
    );
    expect(screen.getAllByText('مقدم خدمة').length).toBeGreaterThan(0);
  });

  it('offers illustrated not-found recovery, quick suggestions, and cross-category rescue on Discover', async () => {
    await render(<Explore />);

    await fireEvent.press(
      screen.getByRole('button', { name: 'الكهرباء والطاقة' }),
    );
    await fireEvent.changeText(screen.getByLabelText(inputLabel), 'أحمد');

    expect(
      screen.getByRole('header', { name: 'ملقيناش خدمات مطابقة لبحثك' }),
    ).toBeTruthy();
    expect(screen.getByText('لقينا ١ خدمة مطابقة في أقسام تانية')).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', { name: 'ابحث في كل الأقسام' }),
    );
    expect(screen.getByLabelText(inputLabel).props.value).toBe('أحمد');
    expect(screen.getByText(providers[0].name)).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText(inputLabel), 'zz-missing');
    await fireEvent.press(
      screen.getByRole('button', {
        name: `ابحث عن ${categories.find((item) => item.id === 'plumbing')!.name}`,
      }),
    );
    expect(screen.getByLabelText(inputLabel).props.value).toBe(
      categories.find((item) => item.id === 'plumbing')!.name,
    );
    expect(screen.getByText(providers[0].name)).toBeTruthy();
  });

  it('lets users remove active group filters directly and shows retry on Discover error with zero matches', async () => {
    const view = await render(<Explore />);

    await fireEvent.press(
      screen.getByRole('button', { name: 'تصفية الأقسام' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'صحة وطب' }));
    await fireEvent.press(screen.getByRole('button', { name: 'عرض النتائج' }));

    await fireEvent.press(
      screen.getByRole('button', { name: 'إزالة فلتر صحة وطب' }),
    );
    expect(screen.getByText(providers[0].name)).toBeTruthy();

    mockState.publicError = 'offline';
    await fireEvent.changeText(screen.getByLabelText(inputLabel), 'zz-missing');
    await view.rerender(<Explore />);

    expect(screen.queryByText('ملقيناش خدمات مطابقة لبحثك')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'جرّب تاني' }));
    expect(mockState.loadMorePublicProviders).toHaveBeenCalledTimes(1);
  });
});
