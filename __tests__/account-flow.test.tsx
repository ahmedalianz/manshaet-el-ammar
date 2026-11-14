import { useEffect } from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { FeedbackProvider } from '../src/components/ui/Feedback';

import { act, fireEvent, render, screen } from './helpers/render';
import { Pressable, Text } from 'react-native';
import MoreScreen from '../src/app/(tabs)/more';
import ProfileScreen from '../src/app/account/profile';
import {
  ProviderStateProvider,
  useProviderState,
} from './fixtures/MockProviderContext';
import { router } from 'expo-router';
jest.mock('../src/features/provider/ProviderContext', () =>
  jest.requireActual('./fixtures/MockProviderContext'),
);

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '9.8.7' } },
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));
jest.mock('../src/features/discovery/components/DiscoveryUi', () => ({
  BackHeader: () => null,
  CategoryIcon: () => null,
}));

let current: ReturnType<typeof useProviderState>;
function SessionControls() {
  const session = useProviderState();
  useEffect(() => {
    current = session;
  }, [session]);
  return (
    <>
      <Pressable onPress={() => current.signIn('listings')}>
        <Text>provider session</Text>
      </Pressable>
      <Pressable onPress={() => current.signIn('admin')}>
        <Text>admin session</Text>
      </Pressable>
    </>
  );
}
async function setup(profile = false) {
  await render(
    <FeedbackProvider>
      <ProviderStateProvider>
        <SessionControls />
        <MoreScreen />
        {profile ? <ProfileScreen /> : null}
      </ProviderStateProvider>
    </FeedbackProvider>,
  );
}
describe('account and More integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  it('shows only guest account actions and reads app version from Expo', async () => {
    await setup();
    expect(screen.getByText('تسجيل الدخول / إنشاء حساب')).toBeTruthy();
    expect(screen.queryByText('الملف الشخصي والبيانات')).toBeNull();
    expect(screen.queryByText('تسجيل الخروج')).toBeNull();
    expect(screen.queryByText('إدارة الخدمات')).toBeNull();
    expect(screen.getByText(/الإصدار 9.8.7/)).toBeTruthy();
  });
  it('shows provider identity without administrative controls and routes profile/information pages', async () => {
    await setup();
    await fireEvent.press(screen.getByText('provider session'));
    expect(screen.getByText('provider@example.test')).toBeTruthy();
    expect(screen.queryByText('إدارة الخدمات')).toBeNull();
    await fireEvent.press(screen.getByText('الملف الشخصي والبيانات'));
    expect(router.push).toHaveBeenLastCalledWith('/account/profile');
    for (const [title, path] of [
      ['عن التطبيق والدليل', '/info/about'],
      ['تواصل معنا', '/info/contact'],
      ['سياسة الخصوصية والشروط', '/info/privacy'],
    ] as const) {
      await fireEvent.press(screen.getByText(title));
      expect(router.push).toHaveBeenLastCalledWith(path);
    }
  });
  it('shows the current admin queue count, including zero after review', async () => {
    await setup();
    await fireEvent.press(screen.getByText('admin session'));
    expect(
      screen.getByLabelText(
        `إدارة الخدمات، ${current.pendingRequests.length} طلبات جديدة`,
      ),
    ).toBeTruthy();
    await act(() => {
      for (const request of current.pendingRequests)
        current.rejectRequest(request.id, 'سبب تجريبي');
    });
    expect(screen.getByLabelText('إدارة الخدمات، 0 طلبات جديدة')).toBeTruthy();
  });
  it('denies guest profile access without leaking account data', async () => {
    await render(
      <FeedbackProvider>
        <ProviderStateProvider>
          <ProfileScreen />
        </ProviderStateProvider>
      </FeedbackProvider>,
    );
    expect(screen.getByText('سجّل دخولك علشان تعرض ملفك الشخصي.')).toBeTruthy();
    expect(screen.queryByText('provider@example.test')).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: 'اسمك في الحساب — تعديل الاسم',
      }),
    ).toBeNull();
  });
  it('rejects blank names, trims saved names, updates More and preserves service/request data', async () => {
    await setup(true);
    await fireEvent.press(screen.getByText('provider session'));
    const services = JSON.stringify(current.services);
    const requests = JSON.stringify(current.requests);
    await fireEvent.press(
      screen.getByRole('button', { name: 'اسمك في الحساب — تعديل الاسم' }),
    );
    await fireEvent.changeText(screen.getByLabelText('الاسم'), '   ');
    await fireEvent.press(screen.getByText('حفظ التعديلات'));
    expect(screen.getByText('اكتب اسمك، بحد أقصى ١٠٠ حرف.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('الاسم'), '  اسم جديد  ');
    await fireEvent.press(screen.getByText('حفظ التعديلات'));
    expect(current.account?.name).toBe('اسم جديد');
    expect(screen.getAllByText('اسم جديد').length).toBeGreaterThan(1);
    expect(JSON.stringify(current.services)).toBe(services);
    expect(JSON.stringify(current.requests)).toBe(requests);
    expect(screen.getByText('تم الحفظ')).toBeTruthy();
    expect(screen.getByText('اسم حسابك اتحدّث.')).toBeTruthy();
  });
  it('opens the real password reset flow without claiming an email was sent', async () => {
    await setup(true);
    await fireEvent.press(screen.getByText('provider session'));
    await fireEvent.press(screen.getByLabelText('إعادة تعيين كلمة المرور'));
    expect(router.push).toHaveBeenCalledWith('/provider/forgot-password');
    expect(screen.queryByText('تم إرسال رابط إعادة التعيين')).toBeNull();
  });
  it('signs out to guest without deleting services or requests or showing stale profile data', async () => {
    await setup(true);
    await fireEvent.press(screen.getByText('provider session'));
    const services = JSON.stringify(current.services);
    const requests = JSON.stringify(current.requests);
    await fireEvent.press(screen.getByText('تسجيل الخروج'));
    expect(current.role).toBe('provider');
    await fireEvent.press(screen.getByRole('button', { name: 'تسجيل الخروج' }));
    expect(current.role).toBe('guest');
    expect(current.account).toBeUndefined();
    expect(screen.queryByText('provider@example.test')).toBeNull();
    expect(screen.getByText('تسجيل الدخول / إنشاء حساب')).toBeTruthy();
    expect(current.services).toEqual([]);
    expect(current.requests).toEqual([]);
    await act(() => current.signIn('listings'));
    expect(JSON.stringify(current.services)).toBe(services);
    expect(JSON.stringify(current.requests)).toBe(requests);
  });
});
