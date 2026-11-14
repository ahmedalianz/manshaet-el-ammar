import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { FeedbackProvider } from '../src/components/ui/Feedback';

import { render, screen, fireEvent } from './helpers/render';
import { router } from 'expo-router';
import MoreScreen from '../src/app/(tabs)/more';
import { useProviderState } from '../src/features/provider/ProviderContext';
import { initialMockState } from './fixtures/moderation';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: jest.fn(),
}));
jest.mock('../src/features/discovery/components/DiscoveryUi', () => ({
  BackHeader: () => null,
  CategoryIcon: () => null,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));

describe('More admin entry visibility', () => {
  const mockState = jest.mocked(useProviderState);
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it.each(['guest', 'provider'])(
    'hides administration from %s',
    async (role) => {
      const state = initialMockState();
      mockState.mockReturnValue({
        role,
        userId: role === 'guest' ? null : 'demo-listings',
        account: state.accounts.find(
          (account) => account.id === 'demo-listings',
        ),
        pendingRequests: [],
      } as unknown as ReturnType<typeof useProviderState>);
      await render(
        <FeedbackProvider>
          <MoreScreen />
        </FeedbackProvider>,
      );
      expect(screen.queryByText('إدارة الخدمات')).toBeNull();
      expect(screen.queryByText('الإدارة والمراجعة')).toBeNull();
    },
  );
  it('shows the admin entry and opens its dashboard', async () => {
    const state = initialMockState();
    mockState.mockReturnValue({
      role: 'admin',
      userId: 'demo-admin',
      account: state.accounts.find((account) => account.id === 'demo-admin'),
      pendingRequests: state.requests.filter(
        (request) => request.status === 'pending',
      ),
    } as unknown as ReturnType<typeof useProviderState>);
    await render(
      <FeedbackProvider>
        <MoreScreen />
      </FeedbackProvider>,
    );
    await fireEvent.press(screen.getByText('إدارة الخدمات'));
    expect(router.push).toHaveBeenCalledWith('/admin');
  });
});
