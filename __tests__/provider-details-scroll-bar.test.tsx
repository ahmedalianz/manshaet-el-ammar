import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { AccessibilityInfo, Linking } from 'react-native';
import { router } from 'expo-router';
import { FeedbackProvider } from '../src/components/ui/Feedback';
import ProviderDetailsScreen from '../src/app/provider/[id]';
import type { ServiceProvider } from '../src/features/discovery/types';
import { providers } from './fixtures/providers';
import { act, fireEvent, render, screen, waitFor } from './helpers/render';

const mockProvider: ServiceProvider = {
  ...providers[0],
  phone: '01012345678',
  whatsapp: '01012345678',
  dataSource: 'firestore',
  publicationStatus: 'published',
};

const mockRefetch = jest.fn<() => Promise<{ data: ServiceProvider | null }>>();

jest.mock('../src/features/discovery/firebaseQueries', () => ({
  usePublicProvider: () => ({ data: mockProvider, refetch: mockRefetch }),
  useCategoryProviders: () => ({ data: undefined }),
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: 'provider-plumbing-1' }),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => true),
}));

jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: () => ({
    categories: jest.requireActual<
      typeof import('../src/features/discovery/data/categories')
    >('../src/features/discovery/data/categories').categories,
    publicProviders: jest.requireActual<typeof import('./fixtures/providers')>(
      './fixtures/providers',
    ).providers,
    configured: true,
    publicLoading: false,
    categoriesLoading: false,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  mockRefetch.mockResolvedValue({ data: mockProvider });
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function renderScreen() {
  return render(
    <FeedbackProvider>
      <ProviderDetailsScreen />
    </FeedbackProvider>,
  );
}

describe('ProviderDetailsScreen deduplication and bottom scroll-end bar', () => {
  it('omits the duplicated contact section card while keeping address, single shared phone, and copy action in the hero', async () => {
    await renderScreen();

    expect(screen.queryByText('بيانات التواصل والعنوان')).toBeNull();
    expect(screen.getAllByText(mockProvider.address)).toHaveLength(1);
    expect(screen.getAllByText(/01012345678/)).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: 'نسخ رقم التواصل' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'اتصال بمقدم الخدمة' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'فتح واتساب مقدم الخدمة' }),
    ).toBeTruthy();
  });

  it('starts with safety expanded and hours collapsed, and lets residents toggle each section', async () => {
    await renderScreen();
    const safety = screen.getByRole('button', {
      name: 'خلّي بالك قبل ما تتواصل',
    });
    const hours = screen.getByRole('button', { name: 'مواعيد العمل' });
    expect(safety.props.accessibilityState.expanded).toBe(true);
    expect(hours.props.accessibilityState.expanded).toBe(false);
    await fireEvent.press(safety);
    expect(safety.props.accessibilityState.expanded).toBe(false);
    await fireEvent.press(hours);
    expect(hours.props.accessibilityState.expanded).toBe(true);
    expect(
      screen.getByText('المواعيد غير محددة — تواصل مع مقدم الخدمة للتأكيد.'),
    ).toBeTruthy();
  });

  it('hides bottom call and WhatsApp bar initially and reveals it smoothly only at scroll end', async () => {
    const launch = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderScreen();

    const bar = () =>
      screen.getByTestId('provider-bottom-bar', {
        includeHiddenElements: true,
      });
    const scroll = screen.getByTestId('provider-details-scroll');

    expect(screen.queryByTestId('provider-bottom-bar')).toBeNull();
    expect(bar().props.pointerEvents).toBe('none');
    expect(bar().props.accessibilityElementsHidden).toBe(true);
    expect(screen.queryByText('مراسلة واتساب')).toBeNull();

    await act(async () => {
      fireEvent.scroll(scroll, {
        nativeEvent: {
          contentOffset: { x: 0, y: 120 },
          layoutMeasurement: { width: 390, height: 700 },
          contentSize: { width: 390, height: 1200 },
        },
      });
    });

    expect(bar().props.pointerEvents).toBe('none');
    expect(bar().props.accessibilityElementsHidden).toBe(true);
    expect(screen.queryByText('مراسلة واتساب')).toBeNull();

    await act(async () => {
      fireEvent.scroll(scroll, {
        nativeEvent: {
          contentOffset: { x: 0, y: 470 },
          layoutMeasurement: { width: 390, height: 700 },
          contentSize: { width: 390, height: 1200 },
        },
      });
    });

    expect(bar().props.pointerEvents).toBe('auto');
    expect(bar().props.accessibilityElementsHidden).toBe(false);
    expect(screen.getByText('مراسلة واتساب')).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', { name: 'اتصال سريع بمقدم الخدمة' }),
    );
    await waitFor(() =>
      expect(launch).toHaveBeenCalledWith('tel:+201012345678'),
    );

    await fireEvent.press(
      screen.getByRole('button', { name: 'مراسلة مقدم الخدمة على واتساب' }),
    );
    await waitFor(() =>
      expect(launch).toHaveBeenCalledWith('https://wa.me/201012345678'),
    );

    await act(async () => {
      fireEvent.scroll(scroll, {
        nativeEvent: {
          contentOffset: { x: 0, y: 100 },
          layoutMeasurement: { width: 390, height: 700 },
          contentSize: { width: 390, height: 1200 },
        },
      });
    });

    expect(bar().props.pointerEvents).toBe('none');
    expect(bar().props.accessibilityElementsHidden).toBe(true);
    expect(screen.queryByText('مراسلة واتساب')).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
  });
});
