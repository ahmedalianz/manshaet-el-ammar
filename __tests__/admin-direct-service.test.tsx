import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { waitFor, fireEvent, render, screen } from './helpers/render';
import { router } from 'expo-router';
import { FeedbackProvider } from '../src/components/ui/Feedback';
import AddServiceScreen from '../src/app/provider/add';
import EditServiceScreen from '../src/app/provider/edit/[id]';
import AdminDashboard from '../src/app/admin';
import AdminServiceScreen from '../src/app/admin/service/[id]';
import AdminReportScreen from '../src/app/admin/report/[id]';
import CategoryScreen from '../src/app/category/[id]';
import ProviderDetailsScreen from '../src/app/provider/[id]';
import MoreScreen from '../src/app/(tabs)/more';
import { categories } from '../src/features/discovery/data/categories';
import { providers as fixtureProviders } from './fixtures/providers';
import { applyOperation, initialMockState } from './fixtures/moderation';
import type {
  ProviderListing,
  PublishedService,
  ServiceReport,
  ServiceRequest,
  ServiceValues,
} from '../src/features/provider/types';

let mockParams: Record<string, string> = {};
const mockSaveAdminService =
  jest.fn<
    (
      values: ServiceValues,
      id?: string,
      submissionId?: string,
    ) => Promise<string>
  >();
const mockSubmit = jest.fn<() => Promise<string>>();

let mockState: {
  userId: string | null;
  role: 'guest' | 'provider' | 'admin';
  account?: {
    id: string;
    name: string;
    email: string;
    role: 'provider' | 'admin';
  };
  initializing: boolean;
  configured: boolean;
  moderationEnabled: boolean;
  adminLoading: boolean;
  adminError: string | null;
  adminBusy: boolean;
  categoriesLoading: boolean;
  publicLoading: boolean;
  privateLoading: boolean;
  privateRefreshing: boolean;
  privateError: string | null;
  categories: typeof categories;
  listings: ProviderListing[];
  services: PublishedService[];
  requests: ServiceRequest[];
  pendingRequests: ServiceRequest[];
  reports: ServiceReport[];
  publicProviders: typeof fixtureProviders;
};

const basePublished: PublishedService = {
  id: 'foreign-1',
  ownerId: 'original-owner',
  name: 'محل الأمل',
  categoryId: 'plumbing',
  serviceTitle: 'سباك معتمد',
  description: 'صيانة وتأسيس',
  phone: '01012345678',
  whatsapp: '01012345678',
  address: 'شارع المدرسة',
  serviceMode: 'fixed',
  publicationStatus: 'published',
};

const baseArchived: PublishedService = {
  ...basePublished,
  id: 'foreign-archived',
  publicationStatus: 'unpublished',
  unpublishReason: 'راجع العنوان',
};

const baseReport: ServiceReport = {
  id: 'rep-1',
  providerId: 'foreign-1',
  reason: 'الرقم تغيّر',
  status: 'open',
  createdAt: '2026-11-05T10:00:00.000Z',
};

const mockCategoryProvider = {
  ...fixtureProviders[0],
  id: 'foreign-1',
  categoryId: 'plumbing',
  dataSource: 'firestore' as const,
  publicationStatus: 'published' as const,
  phone: '01012345678',
};

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>{`Redirect:${href}`}</Text>;
  },
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  },
  useLocalSearchParams: () => mockParams,
  useIsFocused: () => true,
  useFocusEffect: (callback: () => void | (() => void)) => {
    jest
      .requireActual<typeof import('react')>('react')
      .useEffect(callback, [callback]);
  },
  usePreventRemove: () => () => {},
}));

jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: () => ({
    ...mockState,
    submit: mockSubmit,
    saveAdminService: mockSaveAdminService,
    allocateSubmissionId: () => 'sub-123',
    refresh: jest.fn(),
    signOut: jest.fn(),
    deleteService: jest.fn(),
    unpublishService: jest.fn(),
    restoreService: jest.fn(),
    closeReport: jest.fn(),
    approveRequest: jest.fn(),
    rejectRequest: jest.fn(),
  }),
}));

jest.mock('../src/features/discovery/firebaseQueries', () => ({
  usePublicProvider: () => ({
    data: mockCategoryProvider,
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  }),
  useCategoryProviders: () => ({
    data: [mockCategoryProvider],
    isPending: false,
    isFetching: false,
    isError: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('../src/features/admin/ServiceOwner', () => ({
  ServiceOwner: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));

function resetState(role: 'guest' | 'provider' | 'admin' = 'admin') {
  mockParams = {};
  mockSaveAdminService.mockReset().mockResolvedValue('provider-sub-123');
  mockSubmit.mockReset().mockResolvedValue('provider-sub-123');
  mockState = {
    userId: role === 'guest' ? null : `${role}-uid`,
    role,
    account:
      role === 'guest'
        ? undefined
        : {
            id: `${role}-uid`,
            name: role === 'admin' ? 'مشرف الدليل' : 'مقدم خدمة',
            email: `${role}@example.test`,
            role,
          },
    initializing: false,
    configured: true,
    moderationEnabled: role === 'admin',
    adminLoading: false,
    adminError: null,
    adminBusy: false,
    categoriesLoading: false,
    publicLoading: false,
    privateLoading: false,
    privateRefreshing: false,
    privateError: null,
    categories,
    listings: [],
    services: [basePublished, baseArchived],
    requests: [],
    pendingRequests: [],
    reports: [baseReport],
    publicProviders: [mockCategoryProvider],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  resetState('admin');
});

describe('admin unlimited direct creation & editing any service', () => {
  it('lets admin add a service directly without consent checkbox', async () => {
    mockParams = { from: 'admin' };
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    await render(
      <QueryClientProvider client={queryClient}>
        <FeedbackProvider>
          <AddServiceScreen />
        </FeedbackProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByText('نشر مباشر بصلاحية المشرف')).toBeTruthy();
    await fireEvent.changeText(
      screen.getByLabelText('الاسم اللي هيظهر للناس *'),
      'محمد السباك',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'اختيار نوع الخدمة' }),
    );
    await fireEvent.press(
      screen.getByRole('radio', { name: 'السباكة والمضخات' }),
    );
    await fireEvent.changeText(
      screen.getByLabelText('تخصصك أو اسم مختصر لخدمتك *'),
      'سباك محترف',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'التالي: بيانات التواصل والمكان' }),
    );

    await fireEvent.changeText(
      screen.getByLabelText('رقم التواصل *'),
      '01012345678',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'في مكان ثابت' }));
    await fireEvent.changeText(
      screen.getByLabelText('العنوان بالتفصيل أو علامة مميزة *'),
      'بجوار المسجد الكبير',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'مراجعة البيانات' }),
    );

    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(
      screen.getByText(
        'هيتم نشر الخدمة مباشرة في الدليل العام بدون حد أقصى للعدد.',
      ),
    ).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', { name: 'نشر الخدمة الآن' }),
    );

    await waitFor(() =>
      expect(mockSaveAdminService).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'محمد السباك',
          categoryId: 'plumbing',
          serviceTitle: 'سباك محترف',
          phone: '01012345678',
          address: 'بجوار المسجد الكبير',
          serviceMode: 'fixed',
        }),
        undefined,
        'sub-123',
      ),
    );
    expect(mockSubmit).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/admin/service/[id]',
        params: { id: 'provider-sub-123' },
      }),
    );
  });

  it('lets admin edit a foreign service directly even when it has a pending owner request', async () => {
    mockParams = { id: 'foreign-1', from: 'admin-report', reportId: 'rep-1' };
    mockState.pendingRequests = [
      {
        id: 'req-1',
        providerId: 'foreign-1',
        ownerId: 'original-owner',
        type: 'update',
        status: 'pending',
        proposedData: { ...basePublished, phone: '01112345678' },
        createdAt: '2026-11-05T12:00:00.000Z',
      },
    ];
    mockSaveAdminService.mockResolvedValue('foreign-1');

    await render(
      <FeedbackProvider>
        <EditServiceScreen />
      </FeedbackProvider>,
    );

    expect(screen.getByText(/في طلب تعديل معلّق للخدمة دي/)).toBeTruthy();
    await fireEvent.changeText(
      screen.getByLabelText('تخصصك أو اسم مختصر لخدمتك *'),
      'سباك معتمد — محدّث',
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

    await waitFor(() =>
      expect(mockSaveAdminService).toHaveBeenCalledWith(
        expect.objectContaining({ serviceTitle: 'سباك معتمد — محدّث' }),
        'foreign-1',
        'sub-123',
      ),
    );
    expect(mockSubmit).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/admin/report/[id]',
        params: { id: 'rep-1' },
      }),
    );
  });

  it('blocks regular providers from editing another owner service', async () => {
    resetState('provider');
    mockParams = { id: 'foreign-1' };
    await render(
      <FeedbackProvider>
        <EditServiceScreen />
      </FeedbackProvider>,
    );
    expect(screen.getByText('الخدمة مش متاحة')).toBeTruthy();
  });

  it('shows admin add/edit entry points across admin, public, category, and more screens', async () => {
    await render(
      <FeedbackProvider>
        <AdminDashboard />
      </FeedbackProvider>,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'إضافة خدمة جديدة' }),
    );
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/provider/add',
      params: { from: 'admin' },
    });

    mockParams = { id: 'foreign-archived' };
    await render(
      <FeedbackProvider>
        <AdminServiceScreen />
      </FeedbackProvider>,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'تعديل بيانات الخدمة' }),
    );
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/provider/edit/[id]',
      params: { id: 'foreign-archived', from: 'admin-service' },
    });

    mockParams = { id: 'rep-1' };
    await render(
      <FeedbackProvider>
        <AdminReportScreen />
      </FeedbackProvider>,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'تعديل بيانات الخدمة' }),
    );
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/provider/edit/[id]',
      params: { id: 'foreign-1', from: 'admin-report', reportId: 'rep-1' },
    });

    mockParams = { id: 'plumbing' };
    await render(
      <FeedbackProvider>
        <CategoryScreen />
      </FeedbackProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'تعديل الخدمة' }));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/provider/edit/[id]',
      params: { id: 'foreign-1', from: 'category', categoryId: 'plumbing' },
    });

    mockParams = { id: 'foreign-1' };
    await render(
      <FeedbackProvider>
        <ProviderDetailsScreen />
      </FeedbackProvider>,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'تعديل بيانات الخدمة' }),
    );
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/provider/edit/[id]',
      params: { id: 'foreign-1', from: 'provider' },
    });

    await render(
      <FeedbackProvider>
        <MoreScreen />
      </FeedbackProvider>,
    );
    await fireEvent.press(screen.getByText('إضافة خدمة جديدة'));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/provider/add',
      params: { from: 'admin' },
    });
  });

  it('hides admin edit/add controls on public and more screens from guests and regular providers', async () => {
    for (const role of ['guest', 'provider'] as const) {
      resetState(role);
      mockParams = { id: 'plumbing' };
      const cat = await render(
        <FeedbackProvider>
          <CategoryScreen />
        </FeedbackProvider>,
      );
      expect(cat.queryByRole('button', { name: 'تعديل الخدمة' })).toBeNull();

      mockParams = { id: 'foreign-1' };
      const detail = await render(
        <FeedbackProvider>
          <ProviderDetailsScreen />
        </FeedbackProvider>,
      );
      expect(
        detail.queryByRole('button', { name: 'تعديل بيانات الخدمة' }),
      ).toBeNull();

      const more = await render(
        <FeedbackProvider>
          <MoreScreen />
        </FeedbackProvider>,
      );
      expect(
        more.queryByText('نشر خدمة مباشرة في الدليل بدون حد أقصى'),
      ).toBeNull();
    }
  });

  it('allows adminSave in mock state to create >3 services and edit foreign services while preserving ownerId', () => {
    let state = initialMockState();
    const admin = state.accounts.find((account) => account.role === 'admin')!;
    const sampleValues: ServiceValues = {
      name: 'مزود جديد',
      categoryId: 'plumbing',
      serviceTitle: 'سباك إضافي',
      description: 'وصف',
      phone: '01012345678',
      address: 'البلد',
      serviceMode: 'fixed',
    };
    let seq = 0;
    for (let i = 1; i <= 5; i++) {
      state = applyOperation(
        state,
        admin,
        {
          type: 'adminSave',
          values: { ...sampleValues, serviceTitle: `خدمة مشرف ${i}` },
        },
        { now: () => '2026-11-10T10:00:00.000Z', id: () => `adm-${++seq}` },
      );
    }
    expect(
      state.services.filter((service) => service.ownerId === admin.id),
    ).toHaveLength(5);

    const edited = applyOperation(
      state,
      admin,
      {
        type: 'adminSave',
        providerId: 'owned-changes',
        values: { ...sampleValues, serviceTitle: 'تعديل المشرف المباشر' },
      },
      { now: () => '2026-11-10T11:00:00.000Z', id: () => `adm-${++seq}` },
    );
    const updatedService = edited.services.find(
      (service) => service.id === 'owned-changes',
    )!;
    expect(updatedService.ownerId).toBe('demo-listings');
    expect(updatedService.serviceTitle).toBe('تعديل المشرف المباشر');
    expect(
      edited.requests.find((request) => request.id === 'request-changes')
        ?.status,
    ).toBe('rejected');
  });
});
