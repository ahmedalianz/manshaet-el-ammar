import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { fireEvent, render, screen, waitFor } from './helpers/render';
import { FeedbackProvider } from '../src/components/ui/Feedback';
import PrivacyScreen from '../src/app/info/privacy';
import DeletionScreen from '../src/app/info/deletion';
import ContactScreen from '../src/app/info/contact';
import {
  openSupportLink,
  supportConfig,
  supportEmailUrl,
} from '../src/features/support/config';
import { readWithDeadline, shouldRetryRead } from '../src/lib/network';
import { authErrorMessage } from '../src/features/auth/errors';

const originalPhotoApiUrl = process.env.EXPO_PUBLIC_PHOTO_API_URL;
const mockDeleteAccount = jest.fn<
  (options: { method: 'password' | 'google'; password?: string }) => Promise<{
    deleted: boolean;
    deletedProviderIds: string[];
  }>
>();
const mockAuth: {
  user: {
    uid: string;
    email?: string | null;
    providerData?: { providerId: string }[];
  } | null;
  initializing: boolean;
  isAdmin: boolean;
  deleteAccount: typeof mockDeleteAccount;
} = {
  user: {
    uid: 'owner',
    email: 'owner@example.test',
    providerData: [{ providerId: 'password' }],
  },
  initializing: false,
  isAdmin: false,
  deleteAccount: mockDeleteAccount,
};
jest.mock('../src/features/auth/AuthProvider', () => ({
  useAuth: () => mockAuth,
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));
const setup = (element: React.ReactNode) =>
  render(<FeedbackProvider>{element}</FeedbackProvider>);
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  if (originalPhotoApiUrl === undefined) {
    delete process.env.EXPO_PUBLIC_PHOTO_API_URL;
  } else {
    process.env.EXPO_PUBLIC_PHOTO_API_URL = originalPhotoApiUrl;
  }
});
describe('privacy, support and immediate self-service account deletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_PHOTO_API_URL = 'https://worker.example';
    mockAuth.user = {
      uid: 'owner',
      email: 'owner@example.test',
      providerData: [{ providerId: 'password' }],
    };
    mockAuth.initializing = false;
    mockAuth.isAdmin = false;
    mockDeleteAccount.mockResolvedValue({
      deleted: true,
      deletedProviderIds: ['srv-1'],
    });
  });

  it('redirects signed-out users to sign in with next=deletion', async () => {
    mockAuth.user = null;
    await setup(<DeletionScreen />);
    expect(screen.queryByRole('button', { name: 'حذف حسابي نهائيًا' })).toBeNull();
    await fireEvent.press(
      screen.getByRole('button', { name: 'تسجيل الدخول لحذف الحساب' }),
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/provider/sign-in',
      params: { next: 'deletion' },
    });
  });

  it('hides deletion controls while session is restoring', async () => {
    mockAuth.initializing = true;
    await setup(<DeletionScreen />);
    expect(screen.getByText('بنحمّل حالة حسابك…')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'تسجيل الدخول لحذف الحساب' }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'حذف حسابي نهائيًا' })).toBeNull();
  });

  it('blocks admin accounts from self-service deletion in the UI', async () => {
    mockAuth.isAdmin = true;
    await setup(<DeletionScreen />);
    expect(screen.getByText(/مينفعش تحذف حساب المشرف/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'حذف حسابي نهائيًا' })).toBeNull();
  });

  it('shows an unavailable notice and disables deletion when worker URL is missing', async () => {
    delete process.env.EXPO_PUBLIC_PHOTO_API_URL;
    await setup(<DeletionScreen />);
    expect(screen.getByText(/حذف الحساب غير متاح حاليًا/)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'حذف حسابي نهائيًا' }).props
        .accessibilityState.disabled,
    ).toBe(true);
  });

  it('requires toggle + password, supports cancellation, and deletes password accounts immediately on confirm', async () => {
    await setup(<DeletionScreen />);
    expect(screen.getByText('owner@example.test')).toBeTruthy();
    const deleteButton = screen.getByRole('button', { name: 'حذف حسابي نهائيًا' });
    expect(deleteButton.props.accessibilityState.disabled).toBe(true);

    await fireEvent(
      screen.getByLabelText('أؤكد رغبتي في حذف حسابي وجميع بياناتي نهائيًا'),
      'valueChange',
      true,
    );
    expect(
      screen.getByRole('button', { name: 'حذف حسابي نهائيًا' }).props
        .accessibilityState.disabled,
    ).toBe(true);

    await fireEvent.changeText(
      screen.getByLabelText('كلمة المرور الحالية للتأكيد'),
      'my-secret',
    );
    expect(
      screen.getByRole('button', { name: 'حذف حسابي نهائيًا' }).props
        .accessibilityState.disabled,
    ).toBe(false);

    await fireEvent.press(
      screen.getByRole('button', { name: 'حذف حسابي نهائيًا' }),
    );
    expect(screen.getByText('تأكيد حذف الحساب نهائيًا')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'إلغاء' }));
    expect(mockDeleteAccount).not.toHaveBeenCalled();

    await fireEvent.press(
      screen.getByRole('button', { name: 'حذف حسابي نهائيًا' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'نعم، احذف حسابي نهائيًا' }),
    );

    await waitFor(() =>
      expect(mockDeleteAccount).toHaveBeenCalledWith({
        method: 'password',
        password: 'my-secret',
      }),
    );
    expect(screen.getByText('تم حذف حسابك')).toBeTruthy();
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/more');
  });

  it('shows success feedback and navigates even when auth loss remounts DeletionContent during deletion', async () => {
    const view = await setup(<DeletionScreen />);
    mockDeleteAccount.mockImplementationOnce(async () => {
      mockAuth.user = null;
      await view.rerender(
        <FeedbackProvider>
          <DeletionScreen />
        </FeedbackProvider>,
      );
      return { deleted: true, deletedProviderIds: ['srv-1'] };
    });

    await fireEvent(
      screen.getByLabelText('أؤكد رغبتي في حذف حسابي وجميع بياناتي نهائيًا'),
      'valueChange',
      true,
    );
    await fireEvent.changeText(
      screen.getByLabelText('كلمة المرور الحالية للتأكيد'),
      'my-secret',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'حذف حسابي نهائيًا' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'نعم، احذف حسابي نهائيًا' }),
    );

    await waitFor(() =>
      expect(screen.getByText('تم حذف حسابك')).toBeTruthy(),
    );
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/more');
  });

  it('supports Google reauthentication flow and stays on screen when cancelled', async () => {
    mockAuth.user = {
      uid: 'google-owner',
      email: 'g@example.test',
      providerData: [{ providerId: 'google.com' }],
    };
    mockDeleteAccount.mockResolvedValueOnce({
      deleted: false,
      deletedProviderIds: [],
    });

    await setup(<DeletionScreen />);
    await fireEvent(
      screen.getByLabelText('أؤكد رغبتي في حذف حسابي وجميع بياناتي نهائيًا'),
      'valueChange',
      true,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'تأكيد بحساب Google وحذف الحساب' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'نعم، احذف حسابي نهائيًا' }),
    );

    await waitFor(() =>
      expect(mockDeleteAccount).toHaveBeenCalledWith({
        method: 'google',
        password: '',
      }),
    );
    expect(screen.queryByText('تم حذف حسابك')).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();

    mockDeleteAccount.mockResolvedValueOnce({
      deleted: true,
      deletedProviderIds: [],
    });
    await fireEvent.press(
      screen.getByRole('button', { name: 'تأكيد بحساب Google وحذف الحساب' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'نعم، احذف حسابي نهائيًا' }),
    );
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/(tabs)/more'),
    );
  });

  it('shows an inline Arabic error when deletion fails', async () => {
    mockDeleteAccount.mockRejectedValueOnce({ code: 'auth/invalid-credential' });
    await setup(<DeletionScreen />);
    await fireEvent(
      screen.getByLabelText('أؤكد رغبتي في حذف حسابي وجميع بياناتي نهائيًا'),
      'valueChange',
      true,
    );
    await fireEvent.changeText(
      screen.getByLabelText('كلمة المرور الحالية للتأكيد'),
      'wrong-password',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'حذف حسابي نهائيًا' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'نعم، احذف حسابي نهائيًا' }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(
          'البريد الإلكتروني أو كلمة المرور مش صح. راجعهم وجرّب تاني.',
        ),
      ).toBeTruthy(),
    );
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('opens the owner supplied HTTPS privacy policy', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await setup(<PrivacyScreen />);
    await fireEvent.press(
      screen.getByRole('button', { name: 'فتح سياسة الخصوصية' }),
    );
    expect(open).toHaveBeenCalledWith(supportConfig.privacyUrl);
  });

  it('opens support email without a private account identifier', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await setup(<ContactScreen />);
    await fireEvent.press(
      screen.getByRole('button', { name: 'فتح البريد الإلكتروني' }),
    );
    expect(open).toHaveBeenCalledWith(supportEmailUrl(supportConfig.email)!);
  });

  it('handles missing support configuration without launching', async () => {
    const openURL = jest.fn<(url: string) => Promise<void>>();
    expect(
      await openSupportLink(
        'email',
        { openURL },
        { email: '', privacyUrl: '' },
      ),
    ).toBe(false);
    expect(openURL).not.toHaveBeenCalled();
  });
});
describe('bounded reads and safe retry', () => {
  it('times out stalled reads with a safe Arabic error', async () => {
    jest.useFakeTimers();
    const operation = readWithDeadline(new Promise<never>(() => {}), 100);
    const result = expect(operation).rejects.toMatchObject({
      code: 'deadline-exceeded',
    });
    await jest.advanceTimersByTimeAsync(100);
    await result;
    expect(authErrorMessage({ code: 'deadline-exceeded' })).toMatch(/الشبكة/);
  });
  it('clears deadlines for successful reads', async () => {
    jest.useFakeTimers();
    expect(await readWithDeadline(Promise.resolve('value'))).toBe('value');
    expect(jest.getTimerCount()).toBe(0);
  });
  it('retries only transient reads once, not permission/auth errors', () => {
    expect(shouldRetryRead(0, { code: 'unavailable' })).toBe(true);
    expect(shouldRetryRead(1, { code: 'unavailable' })).toBe(false);
    expect(shouldRetryRead(0, { code: 'permission-denied' })).toBe(false);
    expect(shouldRetryRead(0, { code: 'unauthenticated' })).toBe(false);
    expect(authErrorMessage({ code: 'permission-denied' })).toMatch(/مش مسموح/);
    expect(authErrorMessage({ code: 'auth/requires-recent-login' })).toMatch(
      /سجّل الدخول من جديد/,
    );
    expect(authErrorMessage({ code: 'auth/user-mismatch' })).toMatch(
      /مش نفس حسابك/,
    );
  });
});
