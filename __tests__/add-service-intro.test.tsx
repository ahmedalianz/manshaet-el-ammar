import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from './helpers/render';
import JoinProviderScreen from '../src/app/provider/join';
import { router } from 'expo-router';
let mockUserId: string | undefined;
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));
jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: () => ({ userId: mockUserId }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockUserId = undefined;
});
it('shows the new introduction and preserves guest sign-in context', async () => {
  await render(<JoinProviderScreen />);
  expect(screen.getByText('خلّي أهل بلدك يعرفوا شغلك')).toBeTruthy();
  expect(screen.getByText('مبادرة أهلية مجانية')).toBeTruthy();
  await fireEvent.press(
    screen.getByRole('button', { name: 'ابدأ إضافة خدمتك' }),
  );
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/provider/sign-in',
    params: { next: 'add' },
  });
});
it('opens the existing add route for signed-in providers and lets users leave', async () => {
  mockUserId = 'owner';
  await render(<JoinProviderScreen />);
  await fireEvent.press(
    screen.getByRole('button', { name: 'ابدأ إضافة خدمتك' }),
  );
  expect(router.push).toHaveBeenCalledWith('/provider/add');
  await fireEvent.press(screen.getByRole('button', { name: 'رجوع' }));
  expect(router.back).toHaveBeenCalledTimes(1);
});
