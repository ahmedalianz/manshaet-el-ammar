import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from './helpers/render';
import MyServices from '../src/app/(tabs)/my-services';
import { providers } from './fixtures/providers';
import type { ProviderListing } from '../src/features/provider/types';

const base = { ...providers[0], ownerId: 'owner' };
const fixtures: ProviderListing[] = [
  { ...base, id: 'published', serviceTitle: 'خدمة منشورة فقط' },
  { ...base, id: 'new', status: 'pending', serviceTitle: 'طلب خدمة جديدة' },
  {
    ...base,
    id: 'changes',
    serviceTitle: 'تعديلات خدمة منشورة',
    pendingChanges: { ...base, serviceTitle: 'اقتراح جديد' },
  },
  {
    ...base,
    id: 'rejected',
    status: 'rejected',
    serviceTitle: 'خدمة تحتاج تعديل',
    rejectionReason: 'راجع رقم الموبايل',
  },
  {
    ...base,
    id: 'edit-rejected',
    serviceTitle: 'تعديلات مرفوضة لخدمة منشورة',
    editRejectionReason: 'وضّح عنوان الخدمة',
  },
  {
    ...base,
    id: 'unpublished',
    serviceTitle: 'خدمة غير منشورة',
    publicationStatus: 'unpublished',
  },
];
let mockListings = fixtures;
let mockUserId: string | null = 'owner';
const mockSupport = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (callback: () => void | (() => void)) =>
    jest
      .requireActual<typeof import('react')>('react')
      .useEffect(callback, [callback]),
}));
jest.mock('../src/features/support/useSupportActions', () => ({
  useSupportActions: () => ({ openEmail: mockSupport }),
}));
jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: () => ({
    userId: mockUserId,
    listings: mockListings,
    categories: jest.requireActual<
      typeof import('../src/features/discovery/data/categories')
    >('../src/features/discovery/data/categories').categories,
    refresh: jest.fn(),
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));
afterEach(() => {
  mockListings = fixtures;
  mockUserId = 'owner';
});

async function chooseFilter(name: string) {
  await fireEvent.press(screen.getByRole('button', { name: 'تصفية الخدمات' }));
  await fireEvent.press(screen.getByRole('button', { name }));
  await fireEvent.press(screen.getByRole('button', { name: 'إغلاق الفلاتر' }));
}

describe('Stitch My Services dashboard', () => {
  it('separates publication from review status and combines filters', async () => {
    await render(<MyServices />);
    await fireEvent.press(
      screen.getByRole('button', { name: 'تصفية الخدمات' }),
    );
    for (const label of [
      'كل حالات النشر (٦)',
      'كل حالات الطلب (٦)',
      'منشورة (٣)',
      'قيد المراجعة (٢)',
      'تحتاج تعديل (٢)',
      'غير منشورة (٣)',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
    await fireEvent.press(
      screen.getByRole('button', { name: 'إغلاق الفلاتر' }),
    );
    await chooseFilter('قيد المراجعة (٢)');
    expect(screen.getByText('طلب خدمة جديدة')).toBeTruthy();
    expect(screen.getByText('تعديلات خدمة منشورة')).toBeTruthy();
    expect(screen.queryByText('خدمة منشورة فقط')).toBeNull();
    expect(screen.queryByText('خدمة تحتاج تعديل')).toBeNull();
    await chooseFilter('غير منشورة (١)');
    expect(screen.getByText('طلب خدمة جديدة')).toBeTruthy();
    expect(screen.queryByText('تعديلات خدمة منشورة')).toBeNull();
    await chooseFilter('كل حالات الطلب (٣)');
    expect(screen.getByText('خدمة غير منشورة')).toBeTruthy();
  });

  it('preserves edit, proposal comparison and public preview routes', async () => {
    mockListings = [fixtures[0], fixtures[2]];
    await render(<MyServices />);
    await chooseFilter('منشورة (٢)');
    await fireEvent.press(screen.getByText('تعديل الخدمة'));
    expect(jest.mocked(router.push).mock.calls.at(-1)?.[0]).toEqual({
      pathname: '/provider/edit/[id]',
      params: { id: 'published' },
    });
    await fireEvent.press(screen.getByText('شوف خدمتك زي ما الناس بتشوفها'));
    expect(jest.mocked(router.push).mock.calls.at(-1)?.[0]).toEqual({
      pathname: '/provider/[id]',
      params: { id: 'published' },
    });
    await chooseFilter('قيد المراجعة (١)');
    await fireEvent.press(screen.getByText('عرض التعديلات'));
    expect(jest.mocked(router.push).mock.calls.at(-1)?.[0]).toEqual({
      pathname: '/provider/changes/[id]',
      params: { id: 'changes' },
    });
  });

  it('keeps rejection reasons and correct published-data explanations', async () => {
    await render(<MyServices />);
    await chooseFilter('تحتاج تعديل (٢)');
    expect(screen.getByText('راجع رقم الموبايل')).toBeTruthy();
    expect(screen.getByText('وضّح عنوان الخدمة')).toBeTruthy();
    expect(screen.getByText(/خدمتك الحالية لسه منشورة/)).toBeTruthy();
    expect(screen.getByText(/خدمتك لسه مش منشورة/)).toBeTruthy();
  });

  it('provides real add, account and support destinations without fabricated metrics or timing', async () => {
    await render(<MyServices />);
    await fireEvent.press(screen.getByRole('button', { name: 'إضافة خدمة' }));
    expect(router.push).toHaveBeenLastCalledWith('/provider/add');
    await fireEvent.press(screen.getByRole('button', { name: 'الملف الشخصي' }));
    expect(router.push).toHaveBeenLastCalledWith('/account/profile');
    await fireEvent.press(
      screen.getByRole('button', { name: 'تواصل مع الدعم' }),
    );
    expect(mockSupport).toHaveBeenCalledTimes(1);
    for (const text of ['اتصالات هاتفية', 'مشاهدات الدليل', 'خلال ساعتين'])
      expect(screen.queryByText(text)).toBeNull();
  });

  it('distinguishes an empty selected filter from a genuinely empty account', async () => {
    const view = await render(<MyServices />);
    await chooseFilter('قيد المراجعة (٢)');
    mockListings = [fixtures[0]];
    await view.rerender(<MyServices />);
    expect(screen.getByText('مفيش خدمات بالحالة دي')).toBeTruthy();
    expect(screen.queryByText('لسه مضفتش أي خدمة')).toBeNull();
    await fireEvent.press(
      screen.getByRole('button', { name: 'عرض كل الخدمات' }),
    );
    expect(screen.getByText('خدمة منشورة فقط')).toBeTruthy();
  });

  it('retains guest and empty account recovery', async () => {
    mockListings = [];
    const view = await render(<MyServices />);
    expect(screen.getByText('لسه مضفتش أي خدمة')).toBeTruthy();
    mockUserId = null;
    await view.rerender(<MyServices />);
    expect(screen.getByText('عندك خدمة بتقدمها؟')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'الملف الشخصي' })).toBeNull();
    await fireEvent.press(screen.getByText('تسجيل الدخول'));
    expect(jest.mocked(router.push).mock.calls.at(-1)?.[0]).toEqual({
      pathname: '/provider/sign-in',
      params: { next: 'my-services', mode: 'sign-in' },
    });
    await fireEvent.press(screen.getByText('إنشاء حساب'));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/provider/sign-in',
      params: { next: 'my-services', mode: 'register' },
    });
  });
});

it('shows the unpublish reason and a correction route instead of a public preview', async () => {
  const listing = {
    ...base,
    id: 'hidden',
    publicationStatus: 'unpublished' as const,
    unpublishReason: 'راجع العنوان',
  };
  mockListings = [listing];
  await render(<MyServices />);
  expect(screen.getByText('سبب الإخفاء: راجع العنوان')).toBeTruthy();
  await fireEvent.press(
    screen.getByRole('button', { name: 'تصحيح وإرسال للمراجعة' }),
  );
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/provider/edit/[id]',
    params: { id: 'hidden' },
  });
  expect(
    screen.queryByRole('button', { name: 'شوف خدمتك زي ما الناس بتشوفها' }),
  ).toBeNull();
});

it('keeps empty-list scroll space stable when the header compacts', async () => {
  mockListings = [];
  const view = await render(<MyServices />);
  await fireEvent(screen.getByTestId('my-services-screen'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 720 } },
  });
  const contentStyle = () =>
    StyleSheet.flatten(
      screen.getByTestId('my-services-list').props.contentContainerStyle,
    );
  expect(contentStyle()).toEqual(
    expect.objectContaining({ minHeight: 720, paddingBottom: 80 }),
  );
  await fireEvent.scroll(screen.getByTestId('my-services-list'), {
    nativeEvent: { contentOffset: { x: 0, y: 80 } },
  });
  expect(contentStyle().minHeight).toBe(720);
  mockListings = fixtures;
  await view.rerender(<MyServices />);
  expect(contentStyle().minHeight).toBeUndefined();
  expect(contentStyle().paddingBottom).toBe(24);
});
