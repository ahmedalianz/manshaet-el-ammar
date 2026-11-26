import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from './helpers/render';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import Home from '../src/app/(tabs)/index';
import EmergencyScreen from '../src/app/emergency';

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
  router: { push: jest.fn(), back: jest.fn() },
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
  jest.mocked(router.push).mockClear();
  jest.mocked(router.back).mockClear();
  mockState.publicLoading = false;
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
});

it.each([
  ['الإسعاف', '123'],
  ['النجدة', '122'],
  ['المطافي', '180'],
])(
  'shows verified %s and opens its exact local short code in the dialer without navigating',
  async (label, number) => {
    await render(<Home />);
    expect(Linking.openURL).not.toHaveBeenCalled();
    await fireEvent.press(
      screen.getByRole('button', { name: `اتصل ب${label} على ${number}` }),
    );
    await waitFor(() =>
      expect(Linking.openURL).toHaveBeenCalledWith(`tel:${number}`),
    );
    expect(router.push).not.toHaveBeenCalled();
  },
);

it('navigates to /emergency when pressing the emergency card or its arrow button', async () => {
  await render(<Home />);
  await fireEvent.press(
    screen.getByRole('button', {
      name: 'عرض كل أرقام الطوارئ في مصر ومركز طوخ',
    }),
  );
  expect(router.push).toHaveBeenCalledWith('/emergency');
  expect(Linking.openURL).not.toHaveBeenCalled();

  jest.mocked(router.push).mockClear();
  await fireEvent.press(screen.getByTestId('emergency-shortcut-card'));
  expect(router.push).toHaveBeenCalledWith('/emergency');
  expect(Linking.openURL).not.toHaveBeenCalled();
});

it('shows only the loading state while the home directory initializes', async () => {
  mockState.publicLoading = true;
  await render(<Home />);
  expect(screen.queryByText('أرقام الطوارئ في مصر')).toBeNull();
  expect(screen.getByRole('progressbar')).toBeTruthy();
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

it('renders Egypt and Toukh/Qalyubia emergency directory, filters sections, dials primary/secondary lines and shows fallback on failure', async () => {
  await render(<EmergencyScreen />);

  expect(screen.getByRole('header', { name: 'أرقام الطوارئ' })).toBeTruthy();
  expect(screen.getByText('مستشفى طوخ المركزي (الطوارئ)')).toBeTruthy();
  expect(screen.getByText('مركز شرطة طوخ')).toBeTruthy();
  expect(screen.getByText('إدارة كهرباء طوخ')).toBeTruthy();
  expect(screen.getByText('غرفة عمليات محافظة القليوبية')).toBeTruthy();
  expect(screen.getByText('طوارئ الكهرباء')).toBeTruthy();
  expect(screen.getByText('شرطة المرور')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'طوخ والقليوبية' }));
  expect(screen.getByText('مستشفى طوخ المركزي (الطوارئ)')).toBeTruthy();
  expect(screen.queryByText('طوارئ الكهرباء')).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'الكل' }));
  expect(screen.getByText('طوارئ الكهرباء')).toBeTruthy();

  await fireEvent.press(
    screen.getByRole('button', {
      name: 'اتصل بمستشفى طوخ المركزي (الطوارئ) على 0132460004',
    }),
  );
  await waitFor(() =>
    expect(Linking.openURL).toHaveBeenCalledWith('tel:0132460004'),
  );

  await fireEvent.press(
    screen.getByRole('button', {
      name: 'رقم بديل للتواصل مع مستشفى طوخ المركزي (الطوارئ): 0132460131',
    }),
  );
  await waitFor(() =>
    expect(Linking.openURL).toHaveBeenCalledWith('tel:0132460131'),
  );

  jest.mocked(Linking.openURL).mockRejectedValueOnce(new Error('No dialer'));
  await fireEvent.press(
    screen.getByRole('button', {
      name: 'اتصل بمستشفى طوخ المركزي (الطوارئ) على 0132460004',
    }),
  );
  await waitFor(() =>
    expect(
      screen.getByText('مش قادرين نفتح الاتصال. اطلب 0132460004 من تليفونك.'),
    ).toBeTruthy(),
  );
});
