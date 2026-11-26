import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor, within } from './helpers/render';
import { FeedbackProvider } from '../src/components/ui/Feedback';
import ProviderDetailsScreen from '../src/app/provider/[id]';
import AdminDashboard from '../src/app/admin';
import AdminClaimScreen from '../src/app/admin/claim/[id]';
import AdminServiceScreen from '../src/app/admin/service/[id]';
import {
  submitServiceClaim,
  reviewServiceClaim,
  syncAdminClaimableServices,
  setProviderClaimable,
} from '../src/features/claims/claimsRepository';
import { notifyClaimsChanged } from '../src/features/claims/useServiceClaims';
import { saveAdminProvider } from '../src/features/provider/firebaseAdminRepository';
import {
  mapProvider,
  toStoredValues,
} from '../src/features/provider/firebaseMapping';
import type { Firestore } from '@firebase/firestore';
import type {
  ProviderListing,
  PublishedService,
  ServiceClaim,
  ServiceValues,
} from '../src/features/provider/types';
import type { ServiceProvider } from '../src/features/discovery/types';
import { categories } from '../src/features/discovery/data/categories';

const mockFirestoreData = new Map<string, Record<string, unknown>>();
const mockFirestoreWrites: {
  path: string;
  data?: Record<string, unknown>;
  kind: string;
}[] = [];

jest.mock('@firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ name }),
  deleteField: () => '__delete__',
  doc: (_dbOrCol: unknown, col?: string, id?: string) => ({
    id: id ?? 'generated-id',
    path: col ? `${col}/${id}` : `${String(_dbOrCol)}/generated-id`,
  }),
  query: (...args: unknown[]) => args,
  where: (...args: unknown[]) => args,
  limit: (value: number) => value,
  serverTimestamp: () => 'server-time',
  getDocFromServer: async ({ path }: { path: string }) => ({
    exists: () => mockFirestoreData.has(path),
    id: path.split('/').at(-1),
    data: () => mockFirestoreData.get(path) ?? {},
  }),
  getDocsFromServer: async () => ({
    size: 0,
    docs: [...mockFirestoreData.entries()]
      .filter(([path]) => path.startsWith('serviceClaims/'))
      .map(([path, data]) => ({
        id: path.split('/').at(-1)!,
        ref: { path },
        data: () => data,
      })),
  }),
  runTransaction: async (
    _db: unknown,
    callback: (transaction: unknown) => Promise<unknown>,
  ) => {
    let hasWrittenInTx = false;
    return callback({
      get: async ({ path }: { path: string }) => {
        if (hasWrittenInTx) throw new Error('Read after write');
        return {
          exists: () => mockFirestoreData.has(path),
          id: path.split('/').at(-1),
          data: () => mockFirestoreData.get(path) ?? {},
        };
      },
      set: ({ path }: { path: string }, data: Record<string, unknown>) => {
        hasWrittenInTx = true;
        mockFirestoreWrites.push({ path, data, kind: 'set' });
        mockFirestoreData.set(path, data);
      },
      update: ({ path }: { path: string }, data: Record<string, unknown>) => {
        hasWrittenInTx = true;
        mockFirestoreWrites.push({ path, data, kind: 'update' });
        const next = {
          ...(mockFirestoreData.get(path) ?? {}),
          ...data,
        };
        for (const [key, value] of Object.entries(data)) {
          if (value === '__delete__') delete next[key];
        }
        mockFirestoreData.set(path, next);
      },
      delete: ({ path }: { path: string }) => {
        hasWrittenInTx = true;
        mockFirestoreWrites.push({ path, kind: 'delete' });
        mockFirestoreData.delete(path);
      },
    });
  },
}));

let mockParams: Record<string, string> = { id: 'admin-srv-1' };
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
    replace: (...args: unknown[]) => mockRouterReplace(...args),
    back: jest.fn(),
  },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));

const sampleValues: ServiceValues = {
  name: 'محل الأمل للأدوات الصحية',
  categoryId: 'plumbing',
  serviceTitle: 'سباكة وتأسيس',
  description: 'خدمة مضافة من الإدارة',
  phone: '01012345678',
  address: 'شارع المدرسة',
  serviceMode: 'fixed',
};

let mockPublicProvider: ServiceProvider = {
  ...sampleValues,
  id: 'admin-srv-1',
  status: 'approved',
  dataSource: 'firestore',
  publicationStatus: 'published',
  claimable: true,
};

let mockContextValue: {
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
  categories: typeof categories;
  categoriesLoading: boolean;
  publicLoading: boolean;
  publicError: string | null;
  privateRefreshing: boolean;
  privateLoading: boolean;
  privateError: string | null;
  listings: ProviderListing[];
  services: PublishedService[];
  requests: [];
  pendingRequests: [];
  reports: [];
  claims: ServiceClaim[];
  pendingClaims: ServiceClaim[];
  refresh: jest.Mock;
  submitClaim: jest.Mock<
    (input: {
      providerId: string;
      claimantName: string;
      claimantPhone: string;
      note?: string;
      consent: boolean;
    }) => Promise<string>
  >;
  approveClaim: jest.Mock<(id: string) => Promise<void>>;
  rejectClaim: jest.Mock<(id: string, reason: string) => Promise<void>>;
  setServiceClaimable: jest.Mock<
    (id: string, claimable: boolean) => Promise<void>
  >;
  syncClaimableServices: jest.Mock<
    (
      ids: string[],
    ) => Promise<{ updated: number; failed: number; lastError: string | null }>
  >;
};

jest.mock('../src/features/discovery/firebaseQueries', () => ({
  usePublicProvider: () => ({
    data: mockPublicProvider,
    isPending: false,
    isError: false,
    refetch: jest.fn(async () => ({
      data: mockPublicProvider,
      isError: false,
    })),
  }),
}));
jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: () => mockContextValue,
}));
jest.mock('../src/features/admin/ServiceOwner', () => ({
  ServiceOwner: () => null,
}));

function resetUiState(overrides: Partial<typeof mockContextValue> = {}) {
  mockParams = { id: 'admin-srv-1' };
  mockPublicProvider = {
    ...sampleValues,
    id: 'admin-srv-1',
    status: 'approved',
    dataSource: 'firestore',
    publicationStatus: 'published',
    claimable: true,
  };
  const submitClaim = jest.fn(
    async (input: {
      providerId: string;
      claimantName: string;
      claimantPhone: string;
      note?: string;
      consent: boolean;
    }) => {
      const claim: ServiceClaim = {
        id: `${input.providerId}_provider-1`,
        providerId: input.providerId,
        serviceName: mockPublicProvider.name,
        serviceTitle: mockPublicProvider.serviceTitle,
        claimantId: 'provider-1',
        claimantName: input.claimantName,
        claimantPhone: input.claimantPhone,
        note: input.note ?? '',
        status: 'pending',
        createdAt: '2026-11-18T12:00:00.000Z',
        updatedAt: '2026-11-18T12:00:00.000Z',
      };
      mockContextValue.claims = [claim];
      mockContextValue.pendingClaims = [claim];
      notifyClaimsChanged();
      return claim.id;
    },
  );
  const approveClaim = jest.fn(async (id: string) => {
    mockContextValue.claims = mockContextValue.claims.map((item) =>
      item.id === id ? { ...item, status: 'approved' } : item,
    );
    mockContextValue.pendingClaims = mockContextValue.claims.filter(
      (item) => item.status === 'pending',
    );
    notifyClaimsChanged();
  });
  const rejectClaim = jest.fn(async (id: string, reason: string) => {
    mockContextValue.claims = mockContextValue.claims.map((item) =>
      item.id === id
        ? { ...item, status: 'rejected', rejectionReason: reason }
        : item,
    );
    mockContextValue.pendingClaims = mockContextValue.claims.filter(
      (item) => item.status === 'pending',
    );
    notifyClaimsChanged();
  });
  const setServiceClaimable = jest.fn(
    async (id: string, claimable: boolean) => {
      mockContextValue.services = mockContextValue.services.map((item) =>
        item.id === id ? { ...item, claimable } : item,
      );
      notifyClaimsChanged();
    },
  );
  const syncClaimableServices = jest.fn(async (ids: string[]) => ({
    updated: ids.length,
    failed: 0,
    lastError: null,
  }));

  mockContextValue = {
    userId: 'provider-1',
    role: 'provider',
    account: {
      id: 'provider-1',
      name: 'أحمد حسن',
      email: 'ahmed@example.test',
      role: 'provider',
    },
    initializing: false,
    configured: true,
    moderationEnabled: false,
    adminLoading: false,
    adminError: null,
    adminBusy: false,
    categories,
    categoriesLoading: false,
    publicLoading: false,
    publicError: null,
    privateRefreshing: false,
    privateLoading: false,
    privateError: null,
    listings: [],
    services: [
      {
        ...sampleValues,
        id: 'admin-srv-1',
        ownerId: 'admin-1',
        claimable: true,
        publicationStatus: 'published',
      },
    ],
    requests: [],
    pendingRequests: [],
    reports: [],
    claims: [],
    pendingClaims: [],
    refresh: jest.fn(),
    submitClaim,
    approveClaim,
    rejectClaim,
    setServiceClaimable,
    syncClaimableServices,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFirestoreData.clear();
  mockFirestoreWrites.length = 0;
  resetUiState();
});

describe('admin-created service ownership claims repository', () => {
  const fakeDb = {} as Firestore;

  it('marks newly created admin services as claimable and retroactively syncs legacy admin-owned services without exposing ownerId on mapProvider', async () => {
    mockFirestoreData.set('categories/plumbing', { active: true });
    const createdId = await saveAdminProvider(
      fakeDb,
      'admin-uid',
      sampleValues,
      undefined,
      'sub-new-admin',
    );
    const createdDoc = mockFirestoreData.get(`providers/${createdId}`);
    expect(createdDoc?.claimable).toBe(true);
    expect(createdDoc?.ownerId).toBe('admin-uid');

    const mapped = mapProvider(createdId, {
      ...createdDoc,
      publishedAt: { toDate: () => new Date('2026-11-18T10:00:00.000Z') },
      updatedAt: { toDate: () => new Date('2026-11-18T10:00:00.000Z') },
    });
    expect(mapped.claimable).toBe(true);
    expect(mapped).not.toHaveProperty('ownerId');

    mockFirestoreData.set('providers/legacy-admin-1', {
      ...toStoredValues(sampleValues),
      ownerId: 'admin-uid',
    });
    mockFirestoreData.set('providers/legacy-admin-with-slot', {
      ...toStoredValues(sampleValues),
      ownerId: 'admin-uid',
    });
    mockFirestoreData.set('requestSlots/legacy-admin-with-slot', {
      ownerId: 'admin-uid',
      providerId: 'legacy-admin-with-slot',
      requestId: 'old-admin-req',
    });
    const synced = await syncAdminClaimableServices(fakeDb, 'admin-uid', [
      'legacy-admin-1',
      'legacy-admin-with-slot',
    ]);
    expect(synced).toBe(2);
    expect(mockFirestoreData.get('providers/legacy-admin-1')?.claimable).toBe(
      true,
    );
    expect(
      mockFirestoreData.get('providers/legacy-admin-with-slot')?.claimable,
    ).toBe(true);

    mockFirestoreData.set('providers/legacy-with-area', {
      ...toStoredValues(sampleValues),
      ownerId: 'admin-uid',
      areaId: 'old-area',
      areadId: 'old-typo-area',
      area: 'وسط البلد',
    });
    const cleanedCount = await syncAdminClaimableServices(fakeDb, 'admin-uid', [
      'legacy-with-area',
    ]);
    expect(cleanedCount).toBe(1);
    const cleanedDoc = mockFirestoreData.get('providers/legacy-with-area');
    expect(cleanedDoc?.claimable).toBe(true);
    expect(cleanedDoc).not.toHaveProperty('areaId');
    expect(cleanedDoc).not.toHaveProperty('areadId');
    expect(cleanedDoc).not.toHaveProperty('area');

    mockFirestoreData.set('providers/other-uid-service', {
      ...toStoredValues(sampleValues),
      ownerId: 'second-admin-uid',
      areaId: 'old-area',
    });
    await setProviderClaimable(fakeDb, 'admin-uid', 'other-uid-service', true);
    const toggledDoc = mockFirestoreData.get('providers/other-uid-service');
    expect(toggledDoc?.claimable).toBe(true);
    expect(toggledDoc?.ownerId).toBe('second-admin-uid');
    expect(toggledDoc).not.toHaveProperty('areaId');
  });

  it('atomically transfers ownership & clears slot on approval', async () => {
    mockFirestoreData.set('providers/srv-claim', {
      ...toStoredValues(sampleValues),
      ownerId: 'admin-uid',
      claimable: true,
    });
    mockFirestoreData.set('requestSlots/srv-claim', {
      ownerId: 'admin-uid',
      providerId: 'srv-claim',
      requestId: 'stale-req',
    });
    const claimId = await submitServiceClaim(fakeDb, 'provider-two', {
      providerId: 'srv-claim',
      claimantName: 'محمد السيد',
      claimantPhone: '01012345678',
      note: 'دي خدمتي',
      consent: true,
    });
    expect(claimId).toBe('srv-claim_provider-two');

    await reviewServiceClaim(fakeDb, 'admin-uid', claimId, 'approved');
    expect(mockFirestoreData.get('providers/srv-claim')).toMatchObject({
      ownerId: 'provider-two',
      claimable: false,
    });
    expect(mockFirestoreData.has('requestSlots/srv-claim')).toBe(false);
    expect(mockFirestoreData.get(`serviceClaims/${claimId}`)?.status).toBe(
      'approved',
    );
  });
});

describe('ProviderDetailsScreen claim UX and admin review UI', () => {
  it('hides the claim prompt for guests, admins, non-claimable services, and already-owned services', async () => {
    resetUiState({ userId: null, role: 'guest', account: undefined });
    await render(
      <FeedbackProvider>
        <ProviderDetailsScreen />
      </FeedbackProvider>,
    );
    expect(screen.queryByTestId('provider-claim-card')).toBeNull();

    resetUiState({
      userId: 'admin-1',
      role: 'admin',
      account: {
        id: 'admin-1',
        name: 'المشرف',
        email: 'admin@example.test',
        role: 'admin',
      },
    });
    await render(
      <FeedbackProvider>
        <ProviderDetailsScreen />
      </FeedbackProvider>,
    );
    expect(screen.queryByTestId('provider-claim-card')).toBeNull();

    resetUiState();
    mockPublicProvider = { ...mockPublicProvider, claimable: undefined };
    await render(
      <FeedbackProvider>
        <ProviderDetailsScreen />
      </FeedbackProvider>,
    );
    expect(screen.queryByTestId('provider-claim-card')).toBeNull();
  });

  it('lets an eligible provider submit a claim request and shows pending state afterwards', async () => {
    await render(
      <FeedbackProvider>
        <ProviderDetailsScreen />
      </FeedbackProvider>,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'طلب نقل الخدمة لحسابي' }),
    );
    await fireEvent.changeText(
      screen.getByLabelText('رقم الموبايل للتواصل والتأكيد *'),
      '01099887766',
    );
    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: /بأكّد إن الخدمة دي تخصّني فعليًا/,
      }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'إرسال طلب النقل' }),
    );
    await waitFor(() =>
      expect(mockContextValue.submitClaim).toHaveBeenCalledWith({
        providerId: 'admin-srv-1',
        claimantName: 'أحمد حسن',
        claimantPhone: '01099887766',
        note: '',
        consent: true,
      }),
    );
    expect(screen.getByText('طلب نقل الخدمة قيد المراجعة')).toBeTruthy();
  });

  it('lists pending claims in Admin Dashboard and lets admin approve or reject in /admin/claim/[id]', async () => {
    const claim: ServiceClaim = {
      id: 'admin-srv-1_provider-1',
      providerId: 'admin-srv-1',
      serviceName: sampleValues.name,
      serviceTitle: sampleValues.serviceTitle,
      claimantId: 'provider-1',
      claimantName: 'أحمد حسن',
      claimantPhone: '01099887766',
      note: 'صاحب المكان',
      status: 'pending',
      createdAt: '2026-11-18T12:00:00.000Z',
      updatedAt: '2026-11-18T12:00:00.000Z',
    };
    resetUiState({
      userId: 'admin-1',
      role: 'admin',
      moderationEnabled: true,
      account: {
        id: 'admin-1',
        name: 'المشرف',
        email: 'admin@example.test',
        role: 'admin',
      },
      claims: [claim],
      pendingClaims: [claim],
    });

    await render(
      <FeedbackProvider>
        <AdminDashboard />
      </FeedbackProvider>,
    );
    const claimsTab = screen.getByRole('tab', { name: 'طلبات الملكية' });
    expect(within(claimsTab).getByText('1')).toBeTruthy();
    await fireEvent.press(claimsTab);
    await fireEvent.press(
      screen.getByRole('button', {
        name: `مراجعة طلب نقل ${claim.serviceName}`,
      }),
    );
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/admin/claim/[id]',
      params: { id: claim.id },
    });

    mockParams = { id: claim.id };
    await render(
      <FeedbackProvider>
        <AdminClaimScreen />
      </FeedbackProvider>,
    );
    expect(screen.getByText('أحمد حسن')).toBeTruthy();
    expect(screen.getByText('صاحب المكان')).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'الموافقة ونقل الملكية لحسابه' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'موافقة ونقل الملكية' }),
    );
    await waitFor(() =>
      expect(mockContextValue.approveClaim).toHaveBeenCalledWith(claim.id),
    );
  });

  it('shows the claimable toggle on AdminServiceScreen for any published service regardless of ownerId', async () => {
    resetUiState({
      userId: 'admin-1',
      role: 'admin',
      moderationEnabled: true,
      account: {
        id: 'admin-1',
        name: 'المشرف',
        email: 'admin@example.test',
        role: 'admin',
      },
      services: [
        {
          ...sampleValues,
          id: 'other-service-1',
          ownerId: 'different-uid',
          claimable: false,
          publicationStatus: 'published',
        },
      ],
    });
    mockParams = { id: 'other-service-1' };
    await render(
      <FeedbackProvider>
        <AdminServiceScreen />
      </FeedbackProvider>,
    );
    expect(
      screen.getByRole('header', { name: 'نقل ملكية الخدمة لصاحبها' }),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', {
        name: 'إتاحة طلب نقل الملكية لصاحب الخدمة',
      }),
    );
    await waitFor(() =>
      expect(mockContextValue.setServiceClaimable).toHaveBeenCalledWith(
        'other-service-1',
        true,
      ),
    );
  });
});
