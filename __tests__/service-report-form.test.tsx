import { beforeEach, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from './helpers/render';
import { router } from 'expo-router';
import Report from '../src/app/provider/report/[id]';
import { providers } from './fixtures/providers';
import { signInDestination } from '../src/features/provider/signInDestination';
const mockSubmit = jest.fn<(...args: unknown[]) => Promise<string>>();
let mockUser: { uid: string } | null;
let mockPending = false;
let mockProvider: (typeof providers)[number] | null;
jest.mock('../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({ user: mockUser, initializing: false, configured: true }),
}));
jest.mock('../src/features/discovery/firebaseQueries', () => ({
  usePublicProvider: () => ({
    data: mockProvider,
    isPending: mockPending,
    isError: false,
  }),
}));
jest.mock('../src/features/reports/firebaseReports', () => ({
  submitServiceReport: (...args: unknown[]) => mockSubmit(...args),
}));
jest.mock('../src/lib/firebase/firestore', () => ({ db: {} }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'provider-plumbing-1' }),
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));
const setup = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <Report />
    </QueryClientProvider>,
  );
beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { uid: 'user-1' };
  mockProvider = providers[0];
  mockPending = false;
  mockSubmit.mockResolvedValue('report-saved');
});
it('shows the linked service ID and requires a meaningful reason', async () => {
  await setup();
  expect(screen.getByText('معرّف الخدمة: provider-plumbing-1')).toBeTruthy();
  await fireEvent.press(
    screen.getByRole('button', { name: 'إرسال البلاغ للمشرف' }),
  );
  expect(mockSubmit).not.toHaveBeenCalled();
  expect(
    screen.getByText('اكتب سبب البلاغ عشان المشرف يقدر يراجعه.'),
  ).toBeTruthy();
});
it('confirms a saved report with its reference and prevents duplicate submission', async () => {
  let finish!: (id: string) => void;
  mockSubmit.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await setup();
  await fireEvent.changeText(
    screen.getByLabelText('سبب البلاغ'),
    'رقم غير صحيح',
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'إرسال البلاغ للمشرف' }),
  );
  expect(screen.queryByText('تم إرسال البلاغ')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'جارٍ الإرسال…' }));
  expect(mockSubmit).toHaveBeenCalledTimes(1);
  expect(mockSubmit).toHaveBeenCalledWith(
    expect.anything(),
    'user-1',
    'provider-plumbing-1',
    'رقم غير صحيح',
  );
  await act(async () => finish('report-saved'));
  expect(screen.getByText('تم إرسال البلاغ')).toBeTruthy();
  expect(screen.getByText('رقم البلاغ: report-saved')).toBeTruthy();
  expect(screen.queryByLabelText('سبب البلاغ')).toBeNull();
});
it('preserves the reason after a failed write and allows retry', async () => {
  mockSubmit.mockRejectedValueOnce(
    Object.assign(new Error('Offline'), { code: 'unavailable' }),
  );
  await setup();
  await fireEvent.changeText(
    screen.getByLabelText('سبب البلاغ'),
    'العنوان مش صحيح',
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'إرسال البلاغ للمشرف' }),
  );
  expect(screen.queryByText('تم إرسال البلاغ')).toBeNull();
  expect(screen.getByLabelText('سبب البلاغ').props.value).toBe(
    'العنوان مش صحيح',
  );
  expect(screen.getByText(/مفيش اتصال بالإنترنت/)).toBeTruthy();
  await fireEvent.press(
    screen.getByRole('button', { name: 'إرسال البلاغ للمشرف' }),
  );
  expect(screen.getByText('تم إرسال البلاغ')).toBeTruthy();
});
it('returns guests to the same report screen after sign-in, including admins', async () => {
  mockUser = null;
  await setup();
  expect(screen.queryByLabelText('سبب البلاغ')).toBeNull();
  await fireEvent.press(
    screen.getByRole('button', { name: 'تسجيل الدخول لإرسال بلاغ' }),
  );
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/provider/sign-in',
    params: { next: 'report', providerId: 'provider-plumbing-1' },
  });
  expect(signInDestination('report', true, 'provider-plumbing-1')).toEqual({
    pathname: '/provider/report/[id]',
    params: { id: 'provider-plumbing-1' },
  });
  expect(signInDestination('report', false, '../../bad')).toBe(
    '/(tabs)/my-services',
  );
});
it('blocks unavailable services and waits for service loading', async () => {
  mockPending = true;
  const result = await setup();
  expect(screen.queryByLabelText('سبب البلاغ')).toBeNull();
  mockPending = false;
  mockProvider = null;
  await result.rerender(
    <QueryClientProvider client={new QueryClient()}>
      <Report />
    </QueryClientProvider>,
  );
  expect(screen.getByText('الخدمة مبقتش متاحة')).toBeTruthy();
  expect(mockSubmit).not.toHaveBeenCalled();
});
