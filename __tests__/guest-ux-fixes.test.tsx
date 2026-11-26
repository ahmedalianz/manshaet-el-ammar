import { afterEach, describe, expect, it, jest } from '@jest/globals';
import * as ReactNative from 'react-native';
import { router } from 'expo-router';
import { fireEvent, render, screen } from './helpers/render';
import Home from '../src/app/(tabs)/index';
import ProviderDetails from '../src/app/provider/[id]';
import { CategoryCard } from '../src/features/discovery/components/DiscoveryUi';
import {
  categories,
  homeCategoryIds,
} from '../src/features/discovery/data/categories';
import { providers } from './fixtures/providers';
import type { ServiceProvider } from '../src/features/discovery/types';

const originalWindow = ReactNative.Dimensions.get('window');
const originalScreen = ReactNative.Dimensions.get('screen');
let mockProviders = [providers[0]];
let mockDetail: ServiceProvider = providers[0];
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: 'provider-plumbing-1' }),
}));
jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: () => ({
    categories: jest.requireActual<
      typeof import('../src/features/discovery/data/categories')
    >('../src/features/discovery/data/categories').categories,
    publicProviders: mockProviders,
    configured: true,
    publicLoading: false,
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
});

describe('guest UX regressions', () => {
  it.each([
    [411, 1, '22%'],
    [360, 1.3, '48%'],
    [360, 2, '100%'],
  ])(
    'keeps category labels scalable at %sdp / %s font scale',
    async (width, fontScale, expectedWidth) => {
      const dimensions = {
        width: width as number,
        height: 800,
        scale: 3,
        fontScale: fontScale as number,
      };
      ReactNative.Dimensions.set({ window: dimensions, screen: dimensions });
      const category = categories.find((item) => item.id === 'carpentry')!;
      await render(
        <CategoryCard category={category} layout="grid" onPress={() => {}} />,
      );
      const tile = screen.getByRole('button');
      const style = ReactNative.StyleSheet.flatten(tile.props.style);
      expect(style.width).toBe(expectedWidth);
      expect(style.height).toBeUndefined();
      const label = screen.getByText(category.name);
      expect(label.props.allowFontScaling).not.toBe(false);
      expect(label.props.numberOfLines).toBeUndefined();
    },
  );

  it.each(['provider', 'category'])(
    'keeps exact Home query when opening a %s result and still allows clearing',
    async (type) => {
      await render(<Home />);
      const query = '  سباك  ';
      const input = screen.getByLabelText('ابحث عن خدمة أو مقدم خدمة...');
      await fireEvent.changeText(input, query);
      const text =
        type === 'provider' ? providers[0].serviceTitle : categories[0].name;
      await fireEvent.press(screen.getAllByText(text)[0]);
      expect(jest.mocked(router.push).mock.calls.at(-1)?.[0]).toEqual({
        pathname: type === 'provider' ? '/provider/[id]' : '/category/[id]',
        params: {
          id: type === 'provider' ? providers[0].id : categories[0].id,
        },
      });
      expect(input.props.value).toBe(query);
      await fireEvent.press(screen.getByLabelText('مسح البحث'));
      expect(input.props.value).toBe('');
    },
  );

  it('recomputes preserved search results when public data changes', async () => {
    const view = await render(<Home />);
    await fireEvent.changeText(
      screen.getByLabelText('ابحث عن خدمة أو مقدم خدمة...'),
      'أحمد',
    );
    expect(screen.queryByText('ملقيناش اللي بتدور عليه')).toBeNull();
    mockProviders = [];
    await view.rerender(<Home />);
    expect(screen.getByText('ملقيناش اللي بتدور عليه')).toBeTruthy();
    expect(
      screen.getByLabelText('ابحث عن خدمة أو مقدم خدمة...').props.value,
    ).toBe('أحمد');
  });

  it.each([undefined, null, '', ' \n\t '])(
    'omits absent description %p while retaining category metadata',
    async (description) => {
      mockDetail = { ...providers[0], description: description as string };
      await render(<ProviderDetails />);
      expect(screen.queryByText('عن الخدمة')).toBeNull();
      expect(screen.queryByText('بيانات التواصل والعنوان')).toBeNull();
      expect(screen.getByText(providers[0].address)).toBeTruthy();
      expect(screen.getByText(categories[0].name)).toBeTruthy();
      expect(screen.getByText(providers[0].name)).toBeTruthy();
    },
  );

  it.each([
    providers[0].description,
    'تفاصيل خدمة عربية طويلة وخبرة في صيانة المنازل. '.repeat(25),
  ])('retains meaningful Arabic description', async (description) => {
    mockDetail = { ...providers[0], description };
    await render(<ProviderDetails />);
    expect(screen.getByText('عن الخدمة')).toBeTruthy();
    expect(screen.getByText(description.trim())).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'عن الخدمة' }));
    expect(screen.queryByText(description.trim())).toBeNull();
    expect(screen.getByText(categories[0].name)).toBeTruthy();
  });
});

it.each([360, 390, 411])(
  'shows four quick categories in one row at %sdp',
  async (width) => {
    const dimensions = {
      width,
      height: 800,
      scale: 3,
      fontScale: 1,
    };
    ReactNative.Dimensions.set({ window: dimensions, screen: dimensions });
    await render(<Home />);
    const tiles = screen
      .getAllByRole('button')
      .filter((button) => button.props.testID?.startsWith('home-category-'));
    expect(tiles.map((tile) => tile.props.testID)).toEqual(
      homeCategoryIds.slice(0, 4).map((id) => `home-category-${id}`),
    );
    for (const id of homeCategoryIds.slice(0, 4)) {
      const tile = screen.getByTestId(`home-category-${id}`);
      expect(ReactNative.StyleSheet.flatten(tile.props.style).flex).toBe(1);
      await fireEvent.press(tile);
      expect(router.push).toHaveBeenLastCalledWith({
        pathname: '/category/[id]',
        params: { id },
      });
    }
    await fireEvent.press(screen.getByRole('button', { name: 'ضيف خدمتك' }));
    expect(router.push).toHaveBeenLastCalledWith('/provider/join');
  },
);
