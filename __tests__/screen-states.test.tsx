import { describe, expect, it, jest } from '@jest/globals';
import { router } from 'expo-router';
import { fireEvent, render, screen } from './helpers/render';
import Home from '../src/app/(tabs)/index';
import Explore from '../src/app/(tabs)/explore';
import NotFound from '../src/app/+not-found';
import Changes from '../src/app/provider/changes/[id]';
import { MissingRecord } from '../src/features/admin/AdminUi';
jest.mock('../src/features/discovery/firebaseQueries', () => ({
  usePublicProvider: () => ({ data: undefined }),
  useCategoryProviders: () => ({ data: undefined }),
}));

jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useFocusEffect: (callback: () => void) =>
    jest
      .requireActual<typeof import('react')>('react')
      .useEffect(callback, [callback]),
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: 'missing' }),
}));
jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: () => ({
    categories: jest.requireActual<
      typeof import('../src/features/discovery/data/categories')
    >('../src/features/discovery/data/categories').categories,
    publicProviders: [],
    listings: [],
  }),
}));
jest.mock('../src/components/ui/Feedback', () => ({
  useFeedback: () => ({ show: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));

describe('empty and missing screen recovery', () => {
  it('offers discovery recovery when Home has no public listings', async () => {
    await render(<Home />);
    expect(
      screen.getByRole('header', { name: 'لسه مفيش خدمات منشورة' }),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'استكشف الخدمات' }),
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/explore',
      params: { filter: 'all' },
    });
  });
  it('resets Explore search and restores category results', async () => {
    await render(<Explore />);
    await fireEvent.changeText(
      screen.getByLabelText('ابحث عن خدمة أو مقدم خدمة...'),
      'zzzz-no-match',
    );
    expect(screen.getByText('ملقيناش خدمات مطابقة لبحثك')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'مسح الفلاتر' }));
    expect(screen.queryByText('ملقيناش خدمات مطابقة لبحثك')).toBeNull();
    expect(screen.getByText('السباكة والمضخات')).toBeTruthy();
  });
  it('recovers from a missing page to Home', async () => {
    await render(<NotFound />);
    await fireEvent.press(screen.getByText('ارجع للرئيسية'));
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
  });
  it('recovers from an unavailable proposal to My Services', async () => {
    await render(<Changes />);
    expect(screen.getByText('التعديلات دي مش متاحة لحسابك.')).toBeTruthy();
    await fireEvent.press(screen.getByText('عرض خدماتي'));
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/my-services');
  });
  it('recovers from missing admin records to management', async () => {
    await render(<MissingRecord />);
    await fireEvent.press(screen.getByText('العودة لإدارة الخدمات'));
    expect(router.replace).toHaveBeenCalledWith('/admin');
  });
});

it('combines Discover search with a group filter and clears each level', async () => {
  await render(<Explore />);
  await fireEvent.press(screen.getByRole('button', { name: 'تصفية الأقسام' }));
  await fireEvent.press(screen.getByRole('button', { name: 'صحة وطب' }));
  await fireEvent.press(screen.getByRole('button', { name: 'عرض النتائج' }));
  await fireEvent.changeText(
    screen.getByLabelText('ابحث عن خدمة أو مقدم خدمة...'),
    'سباك',
  );
  expect(screen.getByText('ملقيناش خدمات مطابقة لبحثك')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'مسح البحث' }));
  expect(screen.getByText('صحة وطب')).toBeTruthy();
  await fireEvent.changeText(
    screen.getByLabelText('ابحث عن خدمة أو مقدم خدمة...'),
    'سباك',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'مسح الفلاتر' }));
  expect(
    screen.getByRole('button', { name: 'الكل' }).props.accessibilityState
      .selected,
  ).toBe(true);
  expect(
    screen.getByLabelText('ابحث عن خدمة أو مقدم خدمة...').props.value,
  ).toBe('');
});
