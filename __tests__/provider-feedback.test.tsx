import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, waitFor } from '@testing-library/react-native';
import { fireEvent, render, screen } from './helpers/render';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import ProviderDetails from '../src/app/provider/[id]';
import { FeedbackProvider } from '../src/components/ui/Feedback';
import { providers as mockProviders } from './fixtures/providers';
const mockProvider = {
  ...mockProviders[0],
  phone: '01012345678',
  whatsapp: '01112345678',
  dataSource: 'firestore' as const,
  publicationStatus: 'published' as const,
};
const mockRefetch =
  jest.fn<
    () => Promise<{ data: typeof mockProvider | null; isError?: boolean }>
  >();
jest.mock('../src/features/discovery/firebaseQueries', () => ({
  usePublicProvider: () => ({ data: mockProvider, refetch: mockRefetch }),
  useCategoryProviders: () => ({ data: undefined }),
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ id: 'provider-plumbing-1' }),
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: () => ({
    categories: jest.requireActual<
      typeof import('../src/features/discovery/data/categories')
    >('../src/features/discovery/data/categories').categories,
    publicProviders: mockProviders,
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));
beforeEach(() => {
  jest.mocked(Clipboard.setStringAsync).mockReset();
  mockProvider.whatsapp = '01112345678';
  mockRefetch.mockReset().mockResolvedValue({ data: mockProvider });
});
const setup = () =>
  render(
    <FeedbackProvider>
      <ProviderDetails />
    </FeedbackProvider>,
  );
describe('provider clipboard notifications', () => {
  it('expands and collapses practical service tips', async () => {
    await setup();
    const toggle = screen.getByRole('button', {
      name: /خلّي بالك قبل ما تتواصل/,
    });
    expect(toggle.props.accessibilityState.expanded).toBe(true);
    expect(screen.getByText(/تأكد من هوية مقدم الخدمة/)).toBeTruthy();
    await fireEvent.press(toggle);
    expect(toggle.props.accessibilityState.expanded).toBe(false);
    expect(screen.queryByText(/تأكد من هوية مقدم الخدمة/)).toBeNull();
    await fireEvent.press(toggle);
    expect(screen.getByText(/تأكد من هوية مقدم الخدمة/)).toBeTruthy();
  });

  it('opens the in-app report form with the service ID', async () => {
    await setup();
    await fireEvent.press(screen.getByText('بلّغنا لو البيانات مش صحيحة'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/provider/report/[id]',
      params: { id: mockProvider.id },
    });
    expect(screen.queryByText('تم إرسال البلاغ')).toBeNull();
  });
  it('shows a nonblocking themed success after copying the displayed number', async () => {
    jest.mocked(Clipboard.setStringAsync).mockResolvedValue(true);
    await setup();
    await fireEvent.press(
      screen.getByRole('button', { name: 'نسخ رقم التواصل' }),
    );
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('+201012345678');
    expect(screen.getAllByText('تم نسخ الرقم')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'إغلاق الإشعار' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'اتصال بمقدم الخدمة' }).props
        .accessibilityState.disabled,
    ).toBe(false);
  });
  it('shows an actionable failure when clipboard returns false', async () => {
    jest.mocked(Clipboard.setStringAsync).mockResolvedValue(false);
    await setup();
    await fireEvent.press(
      screen.getByRole('button', { name: 'نسخ رقم التواصل' }),
    );
    expect(screen.getByText('مش قادرين نفتح التواصل')).toBeTruthy();
    expect(screen.queryByText('تم نسخ الرقم')).toBeNull();
  });
  it('shows failure when the native clipboard rejects', async () => {
    jest
      .mocked(Clipboard.setStringAsync)
      .mockRejectedValue(new Error('Unavailable'));
    await setup();
    await fireEvent.press(
      screen.getByRole('button', { name: 'نسخ رقم التواصل' }),
    );
    expect(screen.getByText('مش قادرين نفتح التواصل')).toBeTruthy();
    expect(screen.queryByText('تم نسخ الرقم')).toBeNull();
  });
  it('opens only the validated dialer URL and blocks rapid taps', async () => {
    const launch = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    let resolve!: (value: { data: typeof mockProvider }) => void;
    mockRefetch.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await setup();
    const button = screen.getByRole('button', { name: 'اتصال بمقدم الخدمة' });
    await fireEvent.press(button);
    await fireEvent.press(button);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ data: mockProvider }));
    await waitFor(() =>
      expect(launch).toHaveBeenCalledWith('tel:+201012345678'),
    );
    launch.mockRestore();
  });
  it('does not copy or launch when the provider was unpublished', async () => {
    const launch = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    mockRefetch.mockResolvedValue({ data: null });
    await setup();
    await fireEvent.press(
      screen.getByRole('button', { name: 'اتصال بمقدم الخدمة' }),
    );
    expect(launch).not.toHaveBeenCalled();
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
    expect(screen.getByText('رقم الموبايل مش متاح دلوقتي')).toBeTruthy();
    launch.mockRestore();
  });
  it('offers a copy fallback for the explicit WhatsApp number', async () => {
    const launch = jest
      .spyOn(Linking, 'openURL')
      .mockRejectedValue(new Error('unavailable'));
    jest.mocked(Clipboard.setStringAsync).mockResolvedValue(true);
    await setup();
    await fireEvent.press(
      screen.getByRole('button', { name: 'فتح واتساب مقدم الخدمة' }),
    );
    expect(launch).toHaveBeenCalledWith('https://wa.me/201112345678');
    expect(
      screen.getByText('مش قادرين نفتح واتساب. تقدر تنسخ الرقم وتتواصل بنفسك.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'نسخ الرقم' }));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('+201112345678');
    launch.mockRestore();
  });
  it('does not use cached numbers if availability cannot be checked', async () => {
    const launch = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    mockRefetch.mockResolvedValue({ data: mockProvider, isError: true });
    await setup();
    await fireEvent.press(
      screen.getByRole('button', { name: 'اتصال بمقدم الخدمة' }),
    );
    expect(launch).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        'مش قادرين نتأكد إن الخدمة لسه متاحة. اتأكد من الإنترنت وجرّب تاني.',
      ),
    ).toBeTruthy();
    launch.mockRestore();
  });
});

it('keeps both actions but displays a shared phone/WhatsApp number once', async () => {
  mockProvider.whatsapp = mockProvider.phone;
  await setup();
  expect(screen.getAllByText(/01012345678/)).toHaveLength(1);
  expect(
    screen.getByRole('button', { name: 'اتصال بمقدم الخدمة' }),
  ).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'فتح واتساب مقدم الخدمة' }),
  ).toBeTruthy();
  expect(screen.queryByText('منشورة في الدليل')).toBeNull();
  expect(screen.queryByText('رقم مقدم الخدمة')).toBeNull();
  expect(screen.getAllByText(mockProvider.address)).toHaveLength(1);
  expect(
    screen.getByRole('button', { name: 'خلّي بالك قبل ما تتواصل' }),
  ).toBeTruthy();
});
it('keeps distinct contact numbers visible with the correct labels', async () => {
  await setup();
  expect(screen.getByText(/01012345678/)).toBeTruthy();
  expect(screen.getByText(/01112345678/)).toBeTruthy();
});
