import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  localDirectory,
  flushLocalDirectory,
  resetLocalDirectory,
} from '../src/features/local/LocalDirectory';
import { Linking } from 'react-native';
import { fireEvent, render, screen, waitFor } from './helpers/render';
import { FeedbackProvider } from '../src/components/ui/Feedback';
import { ProviderCard } from '../src/features/discovery/components/ProviderCard';
import { providers } from './fixtures/providers';
import { fetchProvider } from '../src/features/provider/firebaseRepository';
import type { ServiceProvider } from '../src/features/discovery/types';
jest.mock('../src/lib/firebase/firestore', () => ({ db: {} }));
jest.mock('../src/features/provider/firebaseRepository', () => ({
  fetchProvider: jest.fn(),
}));
const real: ServiceProvider = {
  ...providers[0],
  dataSource: 'firestore',
  publicationStatus: 'published',
  phone: '01012345678',
  whatsapp: '01112345678',
};
const fetch = jest.mocked(fetchProvider);
beforeEach(async () => {
  await flushLocalDirectory();
  await AsyncStorage.clear();
  resetLocalDirectory();
  await localDirectory.hydrate();
});
afterEach(async () => {
  await flushLocalDirectory();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});
async function setup(
  provider = real,
  presentation: 'default' | 'home' | 'directory' | 'illustrated' = 'default',
) {
  const onPress = jest.fn();
  await render(
    <FeedbackProvider>
      <ProviderCard
        provider={provider}
        onPress={onPress}
        presentation={presentation}
      />
    </FeedbackProvider>,
  );
  return onPress;
}
describe('discovery card contact actions', () => {
  it.each(['default', 'illustrated'] as const)(
    'opens call and WhatsApp independently of details navigation in the %s card',
    async (presentation) => {
      fetch.mockResolvedValue(real);
      const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      const navigate = await setup(real, presentation);
      await fireEvent.press(
        screen.getByRole('button', { name: `اتصال بـ ${real.name}` }),
      );
      expect(open).toHaveBeenLastCalledWith('tel:+201012345678');
      expect(navigate).not.toHaveBeenCalled();
      await fireEvent.press(
        screen.getByRole('button', { name: `واتساب ${real.name}` }),
      );
      expect(open).toHaveBeenLastCalledWith('https://wa.me/201112345678');
      expect(navigate).not.toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledTimes(2);
      await fireEvent.press(
        screen.getByRole('button', { name: `تفاصيل ${real.name}` }),
      );
      expect(navigate).toHaveBeenCalledTimes(1);
    },
  );
  it('keeps fixture contact controls disabled', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await setup(providers[0]);
    const button = screen.getByRole('button', {
      name: 'رقم التواصل مش متاح دلوقتي',
    });
    expect(button.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(button);
    expect(fetch).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
  it('does not launch after a cached provider becomes unavailable', async () => {
    fetch.mockResolvedValue(null);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await setup();
    await fireEvent.press(
      screen.getByRole('button', { name: `اتصال بـ ${real.name}` }),
    );
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByText('رقم التواصل مش متاح دلوقتي')).toBeTruthy();
  });
});

it('Home card body opens details while contacts stop propagation', async () => {
  fetch.mockResolvedValue(real);
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const navigate = await setup(real, 'home');
  await fireEvent.press(screen.getByTestId('home-provider-card'));
  expect(navigate).toHaveBeenCalledTimes(1);
  const stopPropagation = jest.fn();
  await fireEvent.press(
    screen.getByRole('button', { name: `اتصال بـ ${real.name}` }),
    { stopPropagation },
  );
  expect(stopPropagation).toHaveBeenCalled();
  expect(open).toHaveBeenLastCalledWith('tel:+201012345678');
  expect(navigate).toHaveBeenCalledTimes(1);
});

it('Home omits unconfigured WhatsApp and missing location without inventing text', async () => {
  const provider = { ...real, whatsapp: undefined, address: '' };
  await setup(provider, 'home');
  expect(
    screen.queryByRole('button', { name: `واتساب ${real.name}` }),
  ).toBeNull();
  expect(screen.queryByText(real.address)).toBeNull();
  expect(
    screen.getByRole('button', { name: `اتصال بـ ${real.name}` }),
  ).toBeTruthy();
});

it('Home stays compact without descriptions, verification or ratings', async () => {
  const provider = { ...real, description: 'تأسيس وصيانة شبكات المياه' };
  await setup(provider, 'home');
  expect(screen.queryByText(provider.description)).toBeNull();
  expect(screen.getByText(provider.serviceTitle)).toBeTruthy();
  expect(screen.queryByText('موثق')).toBeNull();
  expect(screen.queryByText('4.9')).toBeNull();
});

it.each(['default', 'home', 'directory', 'illustrated'] as const)(
  'keeps guest favorites accessible and independent of navigation in the %s card',
  async (presentation) => {
    const navigate = await setup(real, presentation);
    expect(screen.queryByText('حفظ في المفضلة')).toBeNull();
    const save = screen.getByRole('button', {
      name: `حفظ ${real.name} في المفضلة`,
    });
    expect(save.props.accessibilityState.selected).toBe(false);
    const stopPropagation = jest.fn();
    await fireEvent.press(save, { stopPropagation });
    expect(stopPropagation).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: `شيل ${real.name} من المفضلة` })
        .props.accessibilityState.selected,
    ).toBe(true);
    await flushLocalDirectory();
    expect(
      JSON.parse((await AsyncStorage.getItem('directory.public.v1'))!)
        .favoriteIds,
    ).toContain(real.id);
    await fireEvent.press(
      screen.getByRole('button', { name: `شيل ${real.name} من المفضلة` }),
    );
    expect(localDirectory.getCachedProvider(real.id)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: `حفظ ${real.name} في المفضلة` }).props
        .accessibilityState.selected,
    ).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  },
);
it('keeps long Arabic names and full-details navigation while omitting unavailable WhatsApp', async () => {
  const provider = {
    ...real,
    name: 'مقدم خدمة باسم عربي طويل علشان يفضل مقروء من غير قص',
    serviceTitle: 'خدمة منزلية بتفاصيل كتير توضح نوع الشغل المتاح لأهل البلد',
    whatsapp: 'invalid',
    description: 'وصف طويل مش مطلوب في المعاينة',
  };
  const navigate = await setup(provider, 'directory');
  expect(screen.getByText(provider.name)).toBeTruthy();
  expect(screen.queryByText(provider.description)).toBeNull();
  expect(screen.queryByText('واتساب غير متاح')).toBeNull();
  await fireEvent.press(
    screen.getByRole('button', { name: `تفاصيل ${provider.name}` }),
  );
  expect(navigate).toHaveBeenCalledTimes(1);
});

it('surfaces failed local storage even though the card favorite control has no text label', async () => {
  await setup(real, 'home');
  jest
    .spyOn(AsyncStorage, 'setItem')
    .mockRejectedValueOnce(new Error('storage full'));
  await fireEvent.press(
    screen.getByRole('button', { name: `حفظ ${real.name} في المفضلة` }),
  );
  await waitFor(() =>
    expect(screen.getByText('الحفظ على الجهاز مش متاح')).toBeTruthy(),
  );
});
