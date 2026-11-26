import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from './helpers/render';
import { router } from 'expo-router';
import { FeedbackProvider } from '../src/components/ui/Feedback';
import { DeleteServiceAction } from '../src/features/admin/AdminUi';
import AdminClaimScreen from '../src/app/admin/claim/[id]';
import RequestScreen from '../src/app/admin/request/[id]';
import EditServiceScreen from '../src/app/provider/edit/[id]';
import { returnToRoute } from '../src/features/navigation/returnToRoute';
import type {
  PublishedService,
  ServiceClaim,
  ServiceRequest,
  ServiceValues,
} from '../src/features/provider/types';

let mockParams: Record<string, string> = {};
const mockApproveRequest = jest.fn<(id: string) => Promise<void>>(
  async () => {},
);
const mockRejectRequest = jest.fn<
  (id: string, reason: string) => Promise<void>
>(async () => {});
const mockApproveClaim = jest.fn<(id: string) => Promise<void>>(async () => {});
const mockRejectClaim = jest.fn<(id: string, reason: string) => Promise<void>>(
  async () => {},
);
const mockDeleteService = jest.fn<(id: string) => Promise<void>>(
  async () => {},
);
const mockSaveAdminService = jest.fn<() => Promise<string>>(
  async () => 'srv-1',
);

const mockSampleValues: ServiceValues = {
  name: 'أحمد السباك',
  categoryId: 'plumbing',
  serviceTitle: 'سباكة وتأسيس',
  description: 'صيانة كاملة',
  phone: '01012345678',
  address: 'شارع المدرسة',
  serviceMode: 'fixed',
};

const mockBaseService: PublishedService = {
  ...mockSampleValues,
  id: 'srv-1',
  ownerId: 'admin-1',
  claimable: true,
  publicationStatus: 'published',
};

const mockBaseRequest: ServiceRequest = {
  id: 'req-1',
  providerId: 'srv-1',
  ownerId: 'owner-1',
  type: 'create',
  status: 'pending',
  proposedData: mockSampleValues,
  createdAt: '2026-11-18T10:00:00.000Z',
};

const mockBaseClaim: ServiceClaim = {
  id: 'srv-1_owner-1',
  providerId: 'srv-1',
  serviceName: mockSampleValues.name,
  serviceTitle: mockSampleValues.serviceTitle,
  claimantId: 'owner-1',
  claimantName: 'محمد حسن',
  claimantPhone: '01099887766',
  note: 'ده رقمي',
  status: 'pending',
  createdAt: '2026-11-18T11:00:00.000Z',
  updatedAt: '2026-11-18T11:00:00.000Z',
};

jest.mock('expo-router', () => ({
  Redirect: () => null,
  router: {
    dismissTo: jest.fn(),
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
  },
  useLocalSearchParams: () => mockParams,
  useIsFocused: () => true,
  useFocusEffect: () => {},
  usePreventRemove: () => () => {},
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));

jest.mock('../src/features/admin/ServiceOwner', () => ({
  ServiceOwner: () => null,
}));

jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: () => ({
    userId: 'admin-1',
    role: 'admin',
    account: {
      id: 'admin-1',
      name: 'المشرف',
      email: 'admin@example.test',
      role: 'admin',
    },
    initializing: false,
    configured: true,
    moderationEnabled: true,
    adminLoading: false,
    adminError: null,
    adminBusy: false,
    categories: jest.requireActual<
      typeof import('../src/features/discovery/data/categories')
    >('../src/features/discovery/data/categories').categories,
    categoriesLoading: false,
    publicLoading: false,
    privateLoading: false,
    privateRefreshing: false,
    privateError: null,
    listings: [],
    services: [mockBaseService],
    requests: [mockBaseRequest],
    pendingRequests: [mockBaseRequest],
    reports: [],
    claims: [mockBaseClaim],
    pendingClaims: [mockBaseClaim],
    refresh: jest.fn(),
    approveRequest: mockApproveRequest,
    rejectRequest: mockRejectRequest,
    approveClaim: mockApproveClaim,
    rejectClaim: mockRejectClaim,
    deleteService: mockDeleteService,
    saveAdminService: mockSaveAdminService,
    allocateSubmissionId: () => 'sub-nav-1',
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  (router as { dismissTo?: unknown }).dismissTo = jest.fn();
});

describe('admin post-action navigation avoids duplicating Manage Services', () => {
  it('uses router.dismissTo when available and falls back to router.replace when unavailable', () => {
    returnToRoute('/admin');
    expect(router.dismissTo).toHaveBeenCalledWith('/admin');
    expect(router.replace).not.toHaveBeenCalled();

    const original = (router as { dismissTo?: unknown }).dismissTo;
    (router as { dismissTo?: unknown }).dismissTo = undefined;
    try {
      returnToRoute('/admin');
      expect(router.replace).toHaveBeenCalledWith('/admin');
    } finally {
      (router as { dismissTo?: unknown }).dismissTo = original;
    }
  });

  it('unwinds to /admin via dismissTo after deleting a service', async () => {
    await render(
      <FeedbackProvider>
        <DeleteServiceAction id="srv-1" />
      </FeedbackProvider>,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'حذف الخدمة نهائيًا' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'حذف نهائي' }));
    await waitFor(() =>
      expect(mockDeleteService).toHaveBeenCalledWith('srv-1'),
    );
    expect(router.dismissTo).toHaveBeenCalledWith('/admin');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('unwinds to /admin via dismissTo after approving or rejecting an ownership claim', async () => {
    mockParams = { id: mockBaseClaim.id };
    await render(
      <FeedbackProvider>
        <AdminClaimScreen />
      </FeedbackProvider>,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'الموافقة ونقل الملكية لحسابه' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'موافقة ونقل الملكية' }),
    );
    await waitFor(() =>
      expect(mockApproveClaim).toHaveBeenCalledWith(mockBaseClaim.id),
    );
    expect(router.dismissTo).toHaveBeenCalledWith('/admin');
    expect(router.replace).not.toHaveBeenCalled();

    jest.clearAllMocks();
    await render(
      <FeedbackProvider>
        <AdminClaimScreen />
      </FeedbackProvider>,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'رفض الطلب مع توضيح السبب' }),
    );
    await fireEvent.changeText(
      screen.getByLabelText('سبب رفض طلب النقل'),
      'بيانات غير مطابقة',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'تأكيد رفض الطلب' }),
    );
    await waitFor(() =>
      expect(mockRejectClaim).toHaveBeenCalledWith(
        mockBaseClaim.id,
        'بيانات غير مطابقة',
      ),
    );
    expect(router.dismissTo).toHaveBeenCalledWith('/admin');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('unwinds to /admin via dismissTo after approving or rejecting a service request', async () => {
    mockParams = { id: mockBaseRequest.id };
    await render(
      <FeedbackProvider>
        <RequestScreen />
      </FeedbackProvider>,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'الموافقة على الطلب' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'موافقة ونشر' }));
    await waitFor(() =>
      expect(mockApproveRequest).toHaveBeenCalledWith(mockBaseRequest.id),
    );
    expect(router.dismissTo).toHaveBeenCalledWith('/admin');
    expect(router.replace).not.toHaveBeenCalled();

    jest.clearAllMocks();
    await render(
      <FeedbackProvider>
        <RequestScreen />
      </FeedbackProvider>,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'رفض الطلب مع توضيح السبب' }),
    );
    await fireEvent.changeText(
      screen.getByLabelText('سبب الرفض'),
      'راجع العنوان',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'تأكيد رفض الطلب' }),
    );
    await waitFor(() =>
      expect(mockRejectRequest).toHaveBeenCalledWith(
        mockBaseRequest.id,
        'راجع العنوان',
      ),
    );
    expect(router.dismissTo).toHaveBeenCalledWith('/admin');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('unwinds back to /admin/service/[id] via dismissTo after admin saves an edit', async () => {
    mockParams = { id: 'srv-1', from: 'admin-service' };
    await render(
      <FeedbackProvider>
        <EditServiceScreen />
      </FeedbackProvider>,
    );
    await fireEvent.changeText(
      screen.getByLabelText('تخصصك أو اسم مختصر لخدمتك *'),
      'سباكة حديثة',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'التالي: بيانات التواصل والمكان' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'مراجعة البيانات' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'حفظ التعديلات الآن' }),
    );
    await waitFor(() => expect(mockSaveAdminService).toHaveBeenCalled());
    expect(router.dismissTo).toHaveBeenCalledWith({
      pathname: '/admin/service/[id]',
      params: { id: 'srv-1' },
    });
    expect(router.replace).not.toHaveBeenCalled();
  });
});
