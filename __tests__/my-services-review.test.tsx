import { beforeEach, afterEach, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from './helpers/render';
import MyServices from '../src/app/(tabs)/my-services';
import { providers } from './fixtures/providers';
import type {
  ProviderListing,
  ServiceRequest,
} from '../src/features/provider/types';
const mockRefresh = jest.fn<() => Promise<void>>().mockResolvedValue();
let mockFocused = true;
const listing: ProviderListing = {
  ...providers[0],
  id: 'service',
  ownerId: 'owner',
};
const request: ServiceRequest = {
  id: 'review',
  providerId: listing.id,
  ownerId: 'owner',
  type: 'create',
  status: 'pending',
  proposedData: listing,
  createdAt: '2026-11-10T12:00:00Z',
};
const mockState = {
  userId: 'owner' as string | null,
  listings: [listing],
  requests: [request],
  categories: [],
  initializing: false,
  privateLoading: false,
  privateError: null,
  privateRefreshing: false,
  refresh: mockRefresh,
  refreshMyServices: mockRefresh,
};
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (callback: () => void | (() => void)) =>
    jest
      .requireActual<typeof import('react')>('react')
      .useEffect(
        () => (mockFocused ? callback() : undefined),
        [callback, mockFocused],
      ),
}));
jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: () => mockState,
}));
jest.mock('../src/features/support/useSupportActions', () => ({
  useSupportActions: () => ({ openEmail: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockFocused = true;
  mockState.userId = 'owner';
  mockState.listings = [{ ...listing, status: 'pending' }];
  mockState.requests = [{ ...request }];
});
afterEach(() => {
  jest.restoreAllMocks();
});
it('refreshes on focus and foreground, without refreshing for duplicate active events or guests', async () => {
  let notify!: (state: AppStateStatus) => void;
  const remove = jest.fn();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, listener) => {
      notify = listener;
      return { remove };
    });
  const view = await render(<MyServices />);
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  await act(() => {
    notify('background');
    notify('active');
    notify('active');
  });
  expect(mockRefresh).toHaveBeenCalledTimes(2);
  mockFocused = false;
  await view.rerender(<MyServices />);
  expect(remove).toHaveBeenCalled();
  mockFocused = true;
  await view.rerender(<MyServices />);
  expect(mockRefresh).toHaveBeenCalledTimes(3);
  mockState.userId = null;
  await view.rerender(<MyServices />);
  expect(mockRefresh).toHaveBeenCalledTimes(3);
});
it('highlights a newly approved request, acknowledges it, and retains acknowledgement after remount', async () => {
  const view = await render(<MyServices />);
  expect(screen.queryByText('نتيجة مراجعة جديدة')).toBeNull();
  mockFocused = false;
  await view.rerender(<MyServices />);
  mockState.listings = [listing];
  mockState.requests = [
    { ...request, status: 'approved', reviewedAt: '2026-11-12T12:00:00Z' },
  ];
  mockFocused = true;
  await view.rerender(<MyServices />);
  await waitFor(() =>
    expect(screen.getByText('تمت الموافقة على طلب إضافة الخدمة')).toBeTruthy(),
  );
  expect(
    screen.getByRole('button', { name: 'عرض نتائج المراجعة الجديدة' }),
  ).toBeTruthy();
  await fireEvent.press(
    screen.getByRole('button', {
      name: `خلاص تمام — نتيجة مراجعة ${listing.name}`,
    }),
  );
  await waitFor(() =>
    expect(screen.queryByText('نتيجة مراجعة جديدة')).toBeNull(),
  );
  await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalled());
  await view.unmount();
  await render(<MyServices />);
  await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(3));
  expect(screen.queryByText('نتيجة مراجعة جديدة')).toBeNull();
});
it('shows rejected edit decisions and their actual reason while keeping the listing published', async () => {
  mockState.listings = [{ ...listing, editRejectionReason: 'اكتب عنوان أوضح' }];
  mockState.requests = [
    {
      ...request,
      type: 'update',
      status: 'rejected',
      rejectionReason: 'اكتب عنوان أوضح',
      reviewedAt: '2026-11-12T12:00:00Z',
    },
  ];
  await render(<MyServices />);
  await waitFor(() =>
    expect(screen.getByText('تم رفض التعديلات')).toBeTruthy(),
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'عرض تفاصيل نتيجة المراجعة' }),
  );
  expect(screen.getByText('سبب الرفض: اكتب عنوان أوضح')).toBeTruthy();
});

it('opens review results and shows approved decision details', async () => {
  mockState.listings = [listing];
  mockState.requests = [
    { ...request, status: 'approved', reviewedAt: '2026-11-12T12:00:00Z' },
  ];
  await render(<MyServices />);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'عرض نتائج المراجعة الجديدة' }),
    ).toBeTruthy(),
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'عرض تفاصيل نتيجة المراجعة' }),
  );
  expect(screen.getByText(`الخدمة: ${listing.name}`)).toBeTruthy();
  await fireEvent.press(
    screen.getByRole('button', { name: 'عرض نتائج المراجعة الجديدة' }),
  );
  expect(screen.getByRole('header', { name: 'نتائج المراجعة' })).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'إغلاق نتائج المراجعة' }),
  ).toBeTruthy();
  await fireEvent.press(
    screen.getByRole('button', { name: 'إغلاق نتائج المراجعة' }),
  );
  expect(screen.queryByRole('header', { name: 'نتائج المراجعة' })).toBeNull();
});
