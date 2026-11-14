import { beforeEach, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from './helpers/render';
import { ServiceOwner } from '../src/features/admin/ServiceOwner';
const mockFetchProfile =
  jest.fn<(db: unknown, uid: string) => Promise<{ name: string } | null>>();
let mockAdmin = true;
jest.mock('../src/lib/firebase/firestore', () => ({ db: {} }));
jest.mock('../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { uid: 'admin' },
    isAdmin: mockAdmin,
    initializing: false,
  }),
}));
jest.mock('../src/features/provider/firebaseRepository', () => ({
  fetchProfile: (db: unknown, uid: string) => mockFetchProfile(db, uid),
}));
beforeEach(() => {
  mockAdmin = true;
  mockFetchProfile.mockReset();
});
const setup = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: Infinity } },
        })
      }
    >
      <ServiceOwner ownerId="poster-123" />
    </QueryClientProvider>,
  );
it('shows only the posting account name without exposing its ID', async () => {
  mockFetchProfile.mockResolvedValue({ name: 'صاحب الحساب' });
  await setup();
  await waitFor(() => expect(screen.getByText('صاحب الحساب')).toBeTruthy());
  expect(mockFetchProfile).toHaveBeenCalledWith({}, 'poster-123');
  expect(screen.queryByText(/poster-123/)).toBeNull();
});
it('shows a missing-name fallback without exposing the account ID', async () => {
  mockFetchProfile.mockResolvedValue(null);
  await setup();
  await waitFor(() =>
    expect(screen.getByText('اسم الحساب غير متاح')).toBeTruthy(),
  );
  expect(screen.queryByText(/poster-123/)).toBeNull();
});
it('does not fetch private profiles for a non-admin session', async () => {
  mockAdmin = false;
  await setup();
  expect(mockFetchProfile).not.toHaveBeenCalled();
});
