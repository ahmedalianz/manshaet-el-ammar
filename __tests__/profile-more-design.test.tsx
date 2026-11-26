import { beforeEach, expect, it, jest } from '@jest/globals';
import { router } from 'expo-router';
import { fireEvent, render, screen } from './helpers/render';
import { FeedbackProvider } from '../src/components/ui/Feedback';
import More from '../src/app/(tabs)/more';
import Profile from '../src/app/account/profile';
import { useProviderState } from '../src/features/provider/ProviderContext';
import { providers } from './fixtures/providers';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));
jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));
const state = jest.mocked(useProviderState);
function setup(role: 'guest' | 'provider' | 'admin' = 'provider') {
  state.mockReturnValue({
    userId: role === 'guest' ? null : 'account',
    role,
    account:
      role === 'guest'
        ? undefined
        : {
            id: 'account',
            role,
            name: 'أحمد محمود',
            email: 'provider@example.test',
          },
    configured: true,
    pendingRequests: [{ id: 'pending-1' }, { id: 'pending-2' }],
    moderationEnabled: true,
    listings: [providers[0], providers[1]],
    signOut: jest.fn(),
    updateAccountName: jest.fn(),
  } as unknown as ReturnType<typeof useProviderState>);
}
beforeEach(() => {
  jest.clearAllMocks();
  setup();
});
it('shows the guest role and preserves public info and sign-in routes without provider/admin actions', async () => {
  setup('guest');
  await render(
    <FeedbackProvider>
      <More />
    </FeedbackProvider>,
  );
  expect(screen.getByText('حساب زائر')).toBeTruthy();
  expect(screen.queryByText('مسودات الخدمات')).toBeNull();
  expect(screen.queryByRole('button', { name: /^خدماتي/ })).toBeNull();
  expect(screen.queryByText('إدارة الخدمات')).toBeNull();
  await fireEvent.press(screen.getByText('تسجيل الدخول / إنشاء حساب'));
  expect(jest.mocked(router.push).mock.calls.at(-1)?.[0]).toEqual({
    pathname: '/provider/sign-in',
    params: { next: 'more' },
  });
  await fireEvent.press(
    screen.getByRole('button', { name: 'حذف الحساب والبيانات' }),
  );
  expect(router.push).toHaveBeenLastCalledWith('/info/deletion');
  await fireEvent.press(screen.getByRole('button', { name: 'المفضلة' }));
  expect(router.push).toHaveBeenLastCalledWith('/favorites');
});
it('uses the provider listing count for My Services and keeps profile access', async () => {
  await render(
    <FeedbackProvider>
      <More />
    </FeedbackProvider>,
  );
  expect(screen.getByText('مزود خدمة')).toBeTruthy();
  expect(screen.queryByText('مسودات الخدمات')).toBeNull();
  await fireEvent.press(
    screen.getByRole('button', { name: 'خدماتي، عدد الخدمات: ٢' }),
  );
  expect(router.push).toHaveBeenLastCalledWith('/(tabs)/my-services');
  await fireEvent.press(
    screen.getByRole('button', { name: 'الملف الشخصي والبيانات' }),
  );
  expect(router.push).toHaveBeenLastCalledWith('/account/profile');
});
it('shows admin identity and current queue only for an admin', async () => {
  setup('admin');
  await render(
    <FeedbackProvider>
      <More />
    </FeedbackProvider>,
  );
  expect(screen.getByText('مشرف الدليل')).toBeTruthy();
  expect(screen.queryByText('مسودات الخدمات')).toBeNull();
  await fireEvent.press(
    screen.getByRole('button', { name: 'إدارة الخدمات، 2 طلبات جديدة' }),
  );
  expect(router.push).toHaveBeenLastCalledWith('/admin');
  expect(screen.queryByRole('button', { name: /^خدماتي/ })).toBeNull();
});
it('shows one read-only email on Profile, meaningful edit/reset actions and a separate safe deletion route', async () => {
  await render(
    <FeedbackProvider>
      <Profile />
    </FeedbackProvider>,
  );
  expect(screen.getAllByText('provider@example.test')).toHaveLength(1);
  expect(screen.getByText('للقراءة فقط')).toBeTruthy();
  expect(screen.queryByDisplayValue('provider@example.test')).toBeNull();
  await fireEvent.press(
    screen.getByRole('button', { name: 'إعادة تعيين كلمة المرور' }),
  );
  expect(router.push).toHaveBeenLastCalledWith('/provider/forgot-password');
  await fireEvent.press(screen.getByRole('button', { name: 'حذف الحساب' }));
  expect(router.push).toHaveBeenLastCalledWith('/info/deletion');
  await fireEvent.press(
    screen.getByRole('button', { name: 'اسمك في الحساب — تعديل الاسم' }),
  );
  expect(screen.getByLabelText('الاسم')).toBeTruthy();
  await fireEvent.press(screen.getByText('إلغاء'));
  expect(screen.queryByLabelText('الاسم')).toBeNull();
});
