import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from './helpers/render';
import {
  SupportNewScreen,
  SupportListScreen,
  SupportDetailScreen,
} from '../src/features/support/SupportScreens';
import { FeedbackProvider } from '../src/components/ui/Feedback';
import * as requests from '../src/features/support/requests';
import { fetchProfile } from '../src/features/provider/firebaseRepository';
import type { PublishedService } from '../src/features/provider/types';
import { providers } from './fixtures/providers';
import { router } from 'expo-router';
const mockAuth = {
  user: { uid: 'owner' } as { uid: string } | null,
  initializing: false,
  isAdmin: false,
};
let mockTicketId = 'ticket-1';
let mockServices: PublishedService[] = [];
jest.mock('../src/features/auth/AuthProvider', () => ({
  useAuth: () => mockAuth,
}));
jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: () => ({
    role: mockAuth.isAdmin ? 'admin' : 'provider',
    services: mockServices,
    refresh: jest.fn(),
  }),
}));
jest.mock('../src/features/provider/firebaseRepository', () => ({
  fetchProfile: jest.fn(),
}));
jest.mock('../src/lib/firebase/firestore', () => ({ db: {} }));
jest.mock('../src/features/support/requests', () => ({
  ...jest.requireActual<typeof import('../src/features/support/requests')>(
    '../src/features/support/requests',
  ),
  allocateSupportId: jest.fn(() => 'receipt-1'),
  submitSupportRequest: jest.fn(),
  fetchSupportRequests: jest.fn(),
  fetchSupportRequest: jest.fn(),
  reviewSupportRequest: jest.fn(),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: mockTicketId }),
  useFocusEffect: (callback: () => void | (() => void)) =>
    jest
      .requireActual<typeof import('react')>('react')
      .useEffect(callback, [callback]),
  usePreventRemove: () => jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.user = { uid: 'owner' };
  mockTicketId = 'ticket-1';
  mockAuth.isAdmin = false;
  mockServices = [];
  jest.mocked(fetchProfile).mockResolvedValue(null);
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
  expect(requests.submitSupportRequest).toHaveBeenCalledWith(
    expect.anything(),
    'receipt-1',
    'owner',
    'محتاج مساعدة',
  );
});
it('denies direct administration routes before reading tickets', async () => {
  await render(<SupportListScreen admin />);
  expect(screen.getByText(/الصفحة دي متاحة للمشرف فقط/)).toBeTruthy();
  expect(requests.fetchSupportRequests).not.toHaveBeenCalled();
});

it('displays admin summary metrics, status filtering, empty recovery and ticket navigation', async () => {
  mockAuth.isAdmin = true;
  const tickets: requests.SupportRequest[] = [
    {
      id: 'ticket-1',
      ownerId: 'user-1',
      kind: 'support',
      message: 'مشكلة في تحديث رقم الهاتف',
      status: 'received',
      createdAt: '2026-11-10T10:00:00Z',
      updatedAt: '2026-11-10T10:00:00Z',
    },
    {
      id: 'ticket-2',
      ownerId: 'user-2',
      kind: 'support',
      message: 'استفسار عن ساعات العمل',
      status: 'in_review',
      staffNote: 'جاري المراجعة',
      createdAt: '2026-11-11T10:00:00Z',
      updatedAt: '2026-11-11T11:00:00Z',
    },
  ];
  jest.mocked(requests.fetchSupportRequests).mockResolvedValue(tickets);
  await render(<SupportListScreen admin />);
  await waitFor(() =>
    expect(screen.getByText('مشكلة في تحديث رقم الهاتف')).toBeTruthy(),
  );
  expect(screen.getByText('تحتاج متابعة')).toBeTruthy();
  expect(screen.getByText('مكتملة / مغلقة')).toBeTruthy();
  expect(screen.queryByText('حذف حساب')).toBeNull();
  expect(screen.queryByRole('tab', { name: 'حذف الحساب' })).toBeNull();
  expect(screen.getByText('آخر رد: جاري المراجعة')).toBeTruthy();

  await fireEvent.press(
    screen.getByRole('button', { name: 'تصفية حسب حالة الطلب' }),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'تم الحل' }));
  await fireEvent.press(screen.getByRole('button', { name: 'إغلاق الفلاتر' }));

  expect(screen.getByText('مفيش طلبات مطابقة للفلتر ده')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'مسح الفلاتر' }));
  expect(screen.getByText('مشكلة في تحديث رقم الهاتف')).toBeTruthy();
  expect(screen.getByText('استفسار عن ساعات العمل')).toBeTruthy();

  await fireEvent.press(
    screen.getByRole('button', {
      name: 'طلب دعم — تم الاستلام — تفاصيل الطلب',
    }),
  );
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/admin/support/[id]',
    params: { id: 'ticket-1' },
  });
});

it('renders admin ticket details, requires rejection note and updates status', async () => {
  mockAuth.isAdmin = true;
  mockTicketId = 'ticket-sup';
  const supportTicket: requests.SupportRequest = {
    id: 'ticket-sup',
    ownerId: 'user-2',
    kind: 'support',
    message: 'أرجو المساعدة في تعديل ساعات العمل',
    status: 'in_review',
    createdAt: '2026-11-11T10:00:00Z',
    updatedAt: '2026-11-11T10:00:00Z',
  };
  jest.mocked(requests.fetchSupportRequest).mockResolvedValue(supportTicket);
  jest.mocked(requests.reviewSupportRequest).mockResolvedValue();

  await render(<SupportDetailScreen admin />);
  await waitFor(() =>
    expect(screen.getByText('أرجو المساعدة في تعديل ساعات العمل')).toBeTruthy(),
  );
  expect(screen.getByText(/رقم الطلب: ticket-sup/)).toBeTruthy();

  expect(
    screen.getByRole('button', { name: 'مرفوض' }).props.accessibilityState
      .disabled,
  ).toBe(true);

  await fireEvent.changeText(
    screen.getByLabelText('ملاحظة للمستخدم (مطلوبة للرفض)'),
    'تم توضيح الخطوات المطلوبة',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'تم الحل' }));
  await waitFor(() =>
    expect(requests.reviewSupportRequest).toHaveBeenCalledWith(
      expect.anything(),
      'ticket-sup',
      'resolved',
      'تم توضيح الخطوات المطلوبة',
    ),
  );
});

it('shows deduplicated requester names, provider badge and fallback without exposing UIDs on admin support list', async () => {
  mockAuth.isAdmin = true;
  mockServices = [
    {
      ...providers[0],
      id: 'srv-1',
      ownerId: 'user-1',
      name: 'ورشة النور',
      serviceTitle: 'صيانة أجهزة',
      publicationStatus: 'published',
    },
  ];
  const tickets: requests.SupportRequest[] = [
    {
      id: 'ticket-1',
      ownerId: 'user-1',
      kind: 'support',
      message: 'الطلب الأول',
      status: 'received',
      createdAt: '2026-11-10T10:00:00Z',
      updatedAt: '2026-11-10T10:00:00Z',
    },
    {
      id: 'ticket-2',
      ownerId: 'user-1',
      kind: 'support',
      message: 'الطلب الثاني لنفس الحساب',
      status: 'in_review',
      createdAt: '2026-11-11T10:00:00Z',
      updatedAt: '2026-11-11T10:00:00Z',
    },
    {
      id: 'ticket-3',
      ownerId: 'user-2',
      kind: 'support',
      message: 'طلب بدون اسم',
      status: 'received',
      createdAt: '2026-11-12T10:00:00Z',
      updatedAt: '2026-11-12T10:00:00Z',
    },
  ];
  jest.mocked(requests.fetchSupportRequests).mockResolvedValue(tickets);
  jest.mocked(fetchProfile).mockImplementation(async (_db, uid) => {
    if (uid === 'user-1') return { name: 'أحمد محمود' };
    return null;
  });

  await render(<SupportListScreen admin />);
  await waitFor(() =>
    expect(screen.getAllByText('أحمد محمود')).toHaveLength(2),
  );
  expect(screen.getByText('اسم الحساب غير متاح')).toBeTruthy();
  expect(screen.getAllByText('مزود خدمة')).toHaveLength(2);
  expect(fetchProfile).toHaveBeenCalledTimes(2);
  expect(fetchProfile).toHaveBeenCalledWith(expect.anything(), 'user-1');
  expect(fetchProfile).toHaveBeenCalledWith(expect.anything(), 'user-2');
  expect(screen.queryByText(/user-1/)).toBeNull();
  expect(screen.queryByText(/user-2/)).toBeNull();
});

it('shows requester identity, linked services and retry on admin detail', async () => {
  mockAuth.isAdmin = true;
  mockTicketId = 'ticket-detail';
  mockServices = [
    {
      ...providers[0],
      id: 'srv-owned',
      ownerId: 'user-1',
      name: 'مركز الشفاء',
      serviceTitle: 'صيدلية',
      publicationStatus: 'published',
    },
  ];
  const ticket: requests.SupportRequest = {
    id: 'ticket-detail',
    ownerId: 'user-1',
    kind: 'support',
    message: 'استفسار عن تعديل العنوان',
    status: 'received',
    createdAt: '2026-11-10T10:00:00Z',
    updatedAt: '2026-11-10T10:00:00Z',
  };
  jest.mocked(requests.fetchSupportRequest).mockResolvedValue(ticket);
  jest
    .mocked(fetchProfile)
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce({ name: 'أحمد محمود' });

  await render(<SupportDetailScreen admin />);
  await waitFor(() =>
    expect(screen.getByText('مش قادرين نحمّل اسم صاحب الحساب.')).toBeTruthy(),
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'إعادة تحميل صاحب الحساب' }),
  );
  await waitFor(() => expect(screen.getByText('أحمد محمود')).toBeTruthy());
  expect(screen.getByRole('header', { name: 'صاحب الطلب' })).toBeTruthy();
  expect(screen.getByText('خدمات مرتبطة بالحساب')).toBeTruthy();

  await fireEvent.press(
    screen.getByRole('button', { name: 'إدارة خدمة صيدلية' }),
  );
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/admin/service/[id]',
    params: { id: 'srv-owned' },
  });
});

it('does not fetch or display requester profiles in non-admin sessions', async () => {
  mockAuth.isAdmin = false;
  mockAuth.user = { uid: 'user-1' };
  mockTicketId = 'ticket-detail';
  const ticket: requests.SupportRequest = {
    id: 'ticket-detail',
    ownerId: 'user-1',
    kind: 'support',
    message: 'استفسار عن تعديل العنوان',
    status: 'received',
    createdAt: '2026-11-10T10:00:00Z',
    updatedAt: '2026-11-10T10:00:00Z',
  };

  jest.mocked(requests.fetchSupportRequests).mockResolvedValue([ticket]);
  const listView = await render(<SupportListScreen />);
  await waitFor(() =>
    expect(screen.getByText('استفسار عن تعديل العنوان')).toBeTruthy(),
  );
  expect(screen.queryByText(/مقدم الطلب:/)).toBeNull();
  expect(fetchProfile).not.toHaveBeenCalled();
  await listView.unmount();

  jest.mocked(requests.fetchSupportRequest).mockResolvedValue(ticket);
  await render(<SupportDetailScreen />);
  await waitFor(() =>
    expect(screen.getByText('استفسار عن تعديل العنوان')).toBeTruthy(),
  );
  expect(screen.queryByRole('header', { name: 'صاحب الطلب' })).toBeNull();
  expect(fetchProfile).not.toHaveBeenCalled();
});
