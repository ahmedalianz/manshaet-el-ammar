import type { ProviderListing } from '../src/features/provider/types';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from './helpers/render';
import { router } from 'expo-router';
import Category from '../src/app/category/[id]';
import { FeedbackProvider } from '../src/components/ui/Feedback';
import { providers } from './fixtures/providers';
const mockProviders = providers.slice(0, 3).map((provider) => ({
  ...provider,
  dataSource: 'firestore' as const,
  publicationStatus: 'published' as const,
  phone: '01012345678',
}));
let mockRole: 'guest' | 'provider' | 'admin' = 'guest';
let mockUserId: string | null = null;
let mockOwned: ProviderListing[] = [];
let mockCategoryData = mockProviders;
const mockDelete = jest.fn<(id: string) => Promise<void>>();
const mockRefetch = jest.fn<() => Promise<void>>();
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: 'plumbing' }),
}));
jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: () => ({
    categories: jest.requireActual<
      typeof import('../src/features/discovery/data/categories')
    >('../src/features/discovery/data/categories').categories,
    role: mockRole,
    userId: mockUserId,
    listings: mockOwned,
    initializing: false,
    adminBusy: false,
    deleteService: mockDelete,
    configured: true,
    categoriesLoading: false,
    publicLoading: false,
  }),
}));
jest.mock('../src/features/discovery/firebaseQueries', () => ({
  useCategoryProviders: () => ({
    data: mockCategoryData,
    isPending: false,
    isFetching: false,
    isError: false,
    refetch: mockRefetch,
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));
const setup = () =>
  render(
    <FeedbackProvider>
      <Category />
    </FeedbackProvider>,
  );
beforeEach(() => {
  jest.clearAllMocks();
  mockRole = 'guest';
  mockUserId = null;
  mockOwned = [];
  mockCategoryData = mockProviders;
  mockDelete.mockResolvedValue(undefined);
  mockRefetch.mockResolvedValue(undefined);
});
describe('Stitch service directory', () => {
  it('uses the selected category and actual provider count', async () => {
    await setup();
    expect(
      screen.getByRole('header', { name: 'خدمات السباكة والمضخات' }),
    ).toBeTruthy();
    expect(
      screen.getByText('عرض ٣ مقدم خدمة من البيانات المحملة'),
    ).toBeTruthy();
    for (const provider of mockProviders)
      expect(screen.getByText(provider.name)).toBeTruthy();
    for (const provider of mockProviders)
      expect(
        screen.getByRole('button', { name: `اتصال بـ ${provider.name}` }),
      ).toBeTruthy();
    expect(screen.queryByText('اتصال مباشر')).toBeNull();
  });
  it('shows no area filter and searches across all providers', async () => {
    await setup();
    expect(screen.queryByText('تصفية حسب المنطقة')).toBeNull();
    expect(screen.queryByRole('button', { name: 'كل المناطق' })).toBeNull();
    expect(screen.queryAllByRole('button', { name: /^المنطقة:/ })).toHaveLength(
      0,
    );
    await fireEvent.changeText(
      screen.getByLabelText('ابحث بالاسم أو الخدمة أو العنوان...'),
      mockProviders[0].name,
    );
    expect(screen.getByText(mockProviders[0].name)).toBeTruthy();
    expect(screen.queryByText(mockProviders[1].name)).toBeNull();
    await fireEvent.changeText(
      screen.getByLabelText('ابحث بالاسم أو الخدمة أو العنوان...'),
      '',
    );
    for (const provider of mockProviders)
      expect(screen.getByText(provider.name)).toBeTruthy();
  });
  it('preserves navigation to individual provider details', async () => {
    await setup();
    await fireEvent.press(
      screen.getByRole('button', { name: `تفاصيل ${mockProviders[0].name}` }),
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/provider/[id]',
      params: { id: mockProviders[0].id },
    });
  });
});

it.each(['guest', 'provider', 'admin'] as const)(
  'only shows delete controls to admins (%s)',
  async (role) => {
    mockRole = role;
    mockUserId = role === 'guest' ? null : 'signed-in';
    await setup();
    expect(
      screen.queryAllByRole('button', { name: 'حذف الخدمة' }),
    ).toHaveLength(role === 'admin' ? 3 : 0);
    expect(
      screen.queryAllByRole('button', { name: 'إدارة خدمتك' }),
    ).toHaveLength(0);
  },
);
it('shows management only for an owned service and preserves the edit route', async () => {
  mockRole = 'provider';
  mockUserId = 'owner';
  mockOwned = [
    { ...mockProviders[0], ownerId: 'owner' },
    { ...mockProviders[1], ownerId: 'someone-else' },
  ];
  await setup();
  expect(screen.getAllByRole('button', { name: 'إدارة خدمتك' })).toHaveLength(
    1,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'إدارة خدمتك' }));
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/provider/edit/[id]',
    params: { id: mockProviders[0].id },
  });
});
it('confirms admin deletion and refreshes the category without leaving it', async () => {
  mockRole = 'admin';
  mockUserId = 'admin';
  await setup();
  await fireEvent.press(
    screen.getAllByRole('button', { name: 'حذف الخدمة' })[0],
  );
  expect(mockDelete).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'حذف نهائي' }));
  await waitFor(() =>
    expect(mockDelete).toHaveBeenCalledWith(mockProviders[0].id),
  );
  await waitFor(() => expect(mockRefetch).toHaveBeenCalled());
  expect(router.replace).not.toHaveBeenCalled();
});
it('offers an add-service action in a genuinely empty category', async () => {
  mockCategoryData = [];
  await setup();
  expect(
    screen.getByRole('header', { name: 'لسه مفيش خدمات في القسم ده' }),
  ).toBeTruthy();
  await fireEvent.press(
    screen.getByRole('button', { name: 'إضافة خدمة جديدة' }),
  );
  expect(router.push).toHaveBeenCalledWith('/provider/add');
});
