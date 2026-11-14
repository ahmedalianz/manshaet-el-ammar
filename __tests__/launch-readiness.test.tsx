import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Linking } from 'react-native';
import { fireEvent, render, screen } from './helpers/render';
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
const mockAuth: { user: { uid: string } | null; initializing: boolean } = {
  user: { uid: 'owner' },
  initializing: false,
};
jest.mock('../src/features/auth/AuthProvider', () => ({
  useAuth: () => mockAuth,
}));
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));
const setup = (element: React.ReactNode) =>
  render(<FeedbackProvider>{element}</FeedbackProvider>);
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
describe('privacy, support and honest deletion request', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.user = { uid: 'owner' };
    mockAuth.initializing = false;
  });
  it('hides the account deletion request when signed out while keeping public information available', async () => {
    mockAuth.user = null;
    await setup(<DeletionScreen />);
    expect(
      screen.queryByRole('button', { name: 'طلب حذف الحساب بالبريد' }),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'فتح صفحة حذف الحساب والبيانات' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'تواصل مع الدعم' })).toBeTruthy();
  });
  it('hides the request until the session has finished restoring', async () => {
    mockAuth.initializing = true;
    await setup(<DeletionScreen />);
    expect(
      screen.queryByRole('button', { name: 'طلب حذف الحساب بالبريد' }),
    ).toBeNull();
  });
  it('removes the request immediately after signout', async () => {
    const { rerender } = await setup(<DeletionScreen />);
    expect(
      screen.getByRole('button', { name: 'طلب حذف الحساب بالبريد' }),
    ).toBeTruthy();
    mockAuth.user = null;
    await rerender(
      <FeedbackProvider>
        <DeletionScreen />
      </FeedbackProvider>,
    );
    expect(
      screen.queryByRole('button', { name: 'طلب حذف الحساب بالبريد' }),
    ).toBeNull();
  });
  it('opens the owner supplied HTTPS privacy policy', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await setup(<PrivacyScreen />);
    await fireEvent.press(
      screen.getByRole('button', { name: 'فتح سياسة الخصوصية' }),
    );
    expect(open).toHaveBeenCalledWith(supportConfig.privacyUrl);
  });
  it('opens the owner supplied account deletion page', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await setup(<DeletionScreen />);
    await fireEvent.press(
      screen.getByRole('button', { name: 'فتح صفحة حذف الحساب والبيانات' }),
    );
    expect(open).toHaveBeenCalledWith(
      'https://clearpath-account-removal.lovable.app/',
    );
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
  it('allows cancellation without sending a deletion request', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await setup(<DeletionScreen />);
    await fireEvent.press(
      screen.getByRole('button', { name: 'طلب حذف الحساب بالبريد' }),
    );
    expect(open).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'إلغاء' }));
    expect(open).not.toHaveBeenCalled();
  });
  it('requires confirmation and never reports account deletion or automatic email sending', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await setup(<DeletionScreen />);
    await fireEvent.press(
      screen.getByRole('button', { name: 'طلب حذف الحساب بالبريد' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'فتح البريد لطلب الحذف' }),
    );
    expect(open).toHaveBeenCalledWith(
      supportEmailUrl(supportConfig.email, true)!,
    );
    expect(screen.getByText('كمّل إرسال طلبك')).toBeTruthy();
    expect(screen.queryByText('تم حذف الحساب')).toBeNull();
  });
  it('offers recovery when deletion-request email cannot open', async () => {
    jest
      .spyOn(Linking, 'openURL')
      .mockRejectedValue(new Error('mail unavailable'));
    await setup(<DeletionScreen />);
    await fireEvent.press(
      screen.getByRole('button', { name: 'طلب حذف الحساب بالبريد' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'فتح البريد لطلب الحذف' }),
    );
    expect(screen.getByText('مش قادرين نفتح الرابط')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'نسخ العنوان' })).toBeTruthy();
    expect(screen.queryByText('تم حذف الحساب')).toBeNull();
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
  });
});
