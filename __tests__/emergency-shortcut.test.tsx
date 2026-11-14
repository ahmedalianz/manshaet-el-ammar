import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from './helpers/render';
import { Linking } from 'react-native';
import Home from '../src/app/(tabs)/index';
const mockState = {
  publicLoading: false,
  publicProviders: [],
  categories: [],
  publicError: null,
};
jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: () => mockState,
}));
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  router: { push: jest.fn() },
}));
jest.mock('../src/features/provider/RemoteDataNotice', () => ({
  RemoteDataNotice: () => null,
}));
jest.mock('../src/features/discovery/components/ProviderCard', () => ({
  ProviderCard: () => null,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));
beforeEach(() => {
  jest.restoreAllMocks();
  mockState.publicLoading = false;
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
});
it.each([
  ['الإسعاف', '123'],
  ['النجدة', '122'],
  ['المطافي', '180'],
])(
  'shows verified %s and opens its exact local short code in the dialer',
  async (label, number) => {
    await render(<Home />);
    expect(Linking.openURL).not.toHaveBeenCalled();
    await fireEvent.press(
      screen.getByRole('button', { name: `اتصل ب${label} على ${number}` }),
    );
    await waitFor(() =>
      expect(Linking.openURL).toHaveBeenCalledWith(`tel:${number}`),
    );
  },
);
it('keeps emergency shortcuts available without dashboard references or long explanatory copy', async () => {
  mockState.publicLoading = true;
  await render(<Home />);
  expect(screen.getByText('أرقام الطوارئ في مصر')).toBeTruthy();
  expect(screen.queryByText(/آخر مراجعة للمصادر/)).toBeNull();
  expect(screen.queryByRole('link', { name: 'مصدر أرقام الطوارئ' })).toBeNull();
  expect(screen.queryByText(/الأرقام دي منفصلة/)).toBeNull();
  expect(Linking.openURL).not.toHaveBeenCalled();
});
it('leaves the number visible with a useful fallback if the dialer cannot open', async () => {
  jest.mocked(Linking.openURL).mockRejectedValue(new Error('No dialer'));
  await render(<Home />);
  await fireEvent.press(
    screen.getByRole('button', { name: 'اتصل بالإسعاف على 123' }),
  );
  await waitFor(() =>
    expect(
      screen.getByText('مش قادرين نفتح الاتصال. اطلب 123 من تليفونك.'),
    ).toBeTruthy(),
  );
  expect(screen.getByText('123')).toBeTruthy();
});
