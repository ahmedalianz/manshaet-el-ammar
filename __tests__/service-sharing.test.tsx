import { beforeEach, afterEach, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { Linking, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProviderContactActions } from '../src/features/discovery/useProviderContactActions';
import {
  localDirectory,
  resetLocalDirectory,
  flushLocalDirectory,
} from '../src/features/local/LocalDirectory';
import type { ServiceProvider } from '../src/features/discovery/types';
import type { FeedbackApi } from '../src/components/ui/Feedback';
const mockShow = jest.fn<FeedbackApi['show']>();
jest.mock('../src/components/ui/Feedback', () => ({
  useFeedback: () => ({
    show: (...args: Parameters<FeedbackApi['show']>) => mockShow(...args),
  }),
}));
const provider: ServiceProvider = {
  id: 'share-provider',
  name: 'أحمد',
  categoryId: 'plumbing',
  serviceTitle: 'سباك',
  description: '',
  phone: '01012345678',
  address: 'شارع المدارس',

  status: 'approved',
  publicationStatus: 'published',
  dataSource: 'firestore',
};
beforeEach(async () => {
  await flushLocalDirectory();
  await AsyncStorage.clear();
  resetLocalDirectory();
  await localDirectory.hydrate();
  mockShow.mockClear();
});
afterEach(async () => {
  await flushLocalDirectory();
  jest.restoreAllMocks();
});
it('shares fresh public details through the recipient chooser without selecting the provider', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const load = jest
    .fn<() => Promise<ServiceProvider | null>>()
    .mockResolvedValue(provider);
  const { result } = await renderHook(() =>
    useProviderContactActions(load, provider),
  );
  await act(() => result.current.performContact('share'));
  expect(load).toHaveBeenCalledTimes(1);
  const url = open.mock.calls[0][0];
  expect(url).toMatch(/^whatsapp:\/\/send\?text=/);
  expect(url).not.toContain('phone=');
  expect(decodeURIComponent(url)).toContain('شارع المدارس');
  expect(mockShow).not.toHaveBeenCalled();
});
it('blocks confirmed unavailable services and purges their cached contact details', async () => {
  localDirectory.rememberProviders([provider]);
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const { result } = await renderHook(() =>
    useProviderContactActions(async () => null, provider),
  );
  await act(() => result.current.performContact('share'));
  expect(open).not.toHaveBeenCalled();
  expect(localDirectory.getCachedProvider(provider.id)).toBeUndefined();
});
it('offers native share and copy fallback without claiming delivery or treating cancellation as success', async () => {
  jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('not installed'));
  const native = jest.spyOn(Share, 'share').mockResolvedValue({
    action: Share.dismissedAction,
    activityType: undefined,
  });
  const copy = jest.spyOn(Clipboard, 'setStringAsync').mockResolvedValue(true);
  const { result } = await renderHook(() =>
    useProviderContactActions(async () => provider),
  );
  await act(() => result.current.performContact('share'));
  const buttons = mockShow.mock.calls.at(-1)![2]!;
  await act(() =>
    buttons.find((button) => button.text === 'مشاركة')!.onPress!(),
  );
  expect(native).toHaveBeenCalledWith({
    message: expect.stringContaining('01012345678'),
  });
  expect(mockShow).toHaveBeenCalledTimes(1);
  await act(() =>
    buttons.find((button) => button.text === 'نسخ البيانات')!.onPress!(),
  );
  expect(copy).toHaveBeenCalled();
});
it('requires cached-data acknowledgement and cannot resurrect a provider removed while the dialog is open', async () => {
  localDirectory.rememberProviders([provider]);
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const { result } = await renderHook(() =>
    useProviderContactActions(async () => {
      throw { code: 'unavailable' };
    }, provider),
  );
  await act(() => result.current.performContact('share'));
  expect(open).not.toHaveBeenCalled();
  const buttons = mockShow.mock.calls.at(-1)![2]!;
  await act(() => localDirectory.markUnavailable(provider.id));
  await act(() =>
    buttons.find((button) => button.text === 'استخدام البيانات المحفوظة')!
      .onPress!(),
  );
  expect(open).not.toHaveBeenCalled();
});

it('revalidates before native fallback and blocks a listing removed after the chooser was offered', async () => {
  jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('not installed'));
  const native = jest.spyOn(Share, 'share').mockResolvedValue({
    action: Share.dismissedAction,
    activityType: undefined,
  });
  const load = jest
    .fn<() => Promise<ServiceProvider | null>>()
    .mockResolvedValueOnce(provider)
    .mockResolvedValue(null);
  const { result } = await renderHook(() =>
    useProviderContactActions(load, provider),
  );
  await act(() => result.current.performContact('share'));
  const buttons = mockShow.mock.calls.at(-1)![2]!;
  await act(() =>
    buttons.find((button) => button.text === 'مشاركة')!.onPress!(),
  );
  expect(load).toHaveBeenCalledTimes(2);
  expect(native).not.toHaveBeenCalled();
});
