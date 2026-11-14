import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from './helpers/render';
import {
  SupportNewScreen,
  SupportListScreen,
} from '../src/features/support/SupportScreens';
import { FeedbackProvider } from '../src/components/ui/Feedback';
import * as requests from '../src/features/support/requests';
import { router } from 'expo-router';
const mockAuth = {
  user: { uid: 'owner' } as { uid: string } | null,
  initializing: false,
  isAdmin: false,
};
let mockKind = 'support';
jest.mock('../src/features/auth/AuthProvider', () => ({
  useAuth: () => mockAuth,
}));
jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: () => ({
    role: mockAuth.isAdmin ? 'admin' : 'provider',
    refresh: jest.fn(),
  }),
}));
jest.mock('../src/lib/firebase/firestore', () => ({ db: {} }));
jest.mock('../src/features/support/requests', () => ({
  ...jest.requireActual<typeof import('../src/features/support/requests')>(
    '../src/features/support/requests',
  ),
  allocateSupportId: jest.fn(() => 'receipt-1'),
  submitSupportRequest: jest.fn(),
  fetchSupportRequests: jest.fn(),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ kind: mockKind }),
  useFocusEffect: jest.fn(),
  usePreventRemove: () => jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.user = { uid: 'owner' };
  mockKind = 'support';
  mockAuth.isAdmin = false;
});
const setup = () =>
  render(
    <FeedbackProvider>
      <SupportNewScreen />
    </FeedbackProvider>,
  );
it('keeps email-only guests out of private request submission and offers sign-in continuation', async () => {
  mockAuth.user = null;
  await setup();
  expect(screen.queryByLabelText('تفاصيل الطلب')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'تسجيل الدخول' }));
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/provider/sign-in',
    params: { next: 'support' },
  });
  expect(requests.submitSupportRequest).not.toHaveBeenCalled();
});
it('shows a receipt only after server acknowledgement and reuses its ID on retry', async () => {
  jest
    .mocked(requests.submitSupportRequest)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue('receipt-1');
  await setup();
  await fireEvent.changeText(
    screen.getByLabelText('تفاصيل الطلب'),
    'محتاج مساعدة',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'إرسال الطلب' }));
  await waitFor(() =>
    expect(screen.getByText(/لسه متأكدناش إن الطلب وصل/)).toBeTruthy(),
  );
  expect(router.replace).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'إرسال الطلب' }));
  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/support/[id]',
      params: { id: 'receipt-1' },
    }),
  );
  expect(requests.allocateSupportId).toHaveBeenCalledTimes(1);
  expect(
    jest
      .mocked(requests.submitSupportRequest)
      .mock.calls.map((call) => call[1]),
  ).toEqual(['receipt-1', 'receipt-1']);
});
it('requires fresh deletion consent and never claims the account has been deleted', async () => {
  mockKind = 'deletion';
  jest.mocked(requests.submitSupportRequest).mockResolvedValue('receipt-1');
  await setup();
  await fireEvent.changeText(
    screen.getByLabelText('تفاصيل الطلب'),
    'عايز أراجع طلب الحذف',
  );
  expect(
    screen.getByRole('button', { name: 'إرسال الطلب' }).props.accessibilityState
      .disabled,
  ).toBe(true);
  await fireEvent(
    screen.getByLabelText('الموافقة على طلب مراجعة حذف الحساب'),
    'valueChange',
    true,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'إرسال الطلب' }));
  await waitFor(() =>
    expect(requests.submitSupportRequest).toHaveBeenCalledWith(
      expect.anything(),
      'receipt-1',
      'owner',
      'deletion',
      'عايز أراجع طلب الحذف',
      true,
    ),
  );
  expect(screen.queryByText('تم حذف الحساب')).toBeNull();
});
it('denies direct administration routes before reading tickets', async () => {
  await render(<SupportListScreen admin />);
  expect(screen.getByText(/الصفحة دي متاحة للمشرف فقط/)).toBeTruthy();
  expect(requests.fetchSupportRequests).not.toHaveBeenCalled();
});
