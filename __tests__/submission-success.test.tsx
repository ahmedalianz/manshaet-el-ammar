import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { router } from 'expo-router';
import { useProviderState } from '../src/features/provider/ProviderContext';
import * as ReactNative from 'react-native';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';
import { fireEvent, render, screen } from './helpers/render';
import Success from '../src/app/provider/success';
import { colors, darkColors } from '../src/theme/colors';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ providerId: 'submitted-provider' }),
}));
jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: jest.fn(() => ({
    userId: 'demo-listings',
    configured: true,
    requests: [
      {
        providerId: 'submitted-provider',
        ownerId: 'demo-listings',
        status: 'pending',
      },
    ],
  })),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));

beforeEach(() => {
  jest.restoreAllMocks();
  jest.mocked(router.replace).mockClear();
  jest.mocked(router.back).mockClear();
  jest.mocked(useProviderState).mockReturnValue({
    userId: 'demo-listings',
    configured: true,
    requests: [
      {
        providerId: 'submitted-provider',
        ownerId: 'demo-listings',
        status: 'pending',
      },
    ],
  } as ReturnType<typeof useProviderState>);
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
});
describe('server-derived submission success', () => {
  it('shows server-submission copy and review labels', async () => {
    await render(<Success />);
    expect(screen.getByRole('header', { name: 'طلبك وصلنا!' })).toBeTruthy();
    for (const text of [
      'حالة الطلب الحالية',
      'قيد المراجعة',
      'طلب الإضافة وصلنا',
      'تفاصيل خدمتك اتحفظت',
      'مراجعة البيانات ونشر الخدمة',
      'التأكد من صحة بيانات التواصل والعنوان',
    ])
      expect(screen.getByText(text)).toBeTruthy();
    expect(
      screen.getByText(/طلبك قيد المراجعة، ومش هيظهر في الدليل قبل الموافقة/),
    ).toBeTruthy();
    expect(screen.getByText(/طلبك وصلنا وهنراجعه/)).toBeTruthy();
  });
  it.each([
    ['عرض خدماتي', '/(tabs)/my-services'],
    ['ارجع للرئيسية', '/(tabs)'],
  ] as const)('navigates %s immediately', async (label, path) => {
    await render(<Success />);
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(router.replace).toHaveBeenCalledWith(path);
  });
  it('preserves RTL back navigation', async () => {
    await render(<Success />);
    await fireEvent.press(screen.getByRole('button', { name: 'رجوع' }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['light', colors],
    ['dark', darkColors],
  ] as const)(
    'uses %s semantic text and preserves scaling',
    async (scheme, palette) => {
      jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(scheme);
      await render(<Success />);
      const title = screen.getByText('طلبك وصلنا!');
      expect(StyleSheet.flatten(title.props.style).color).toBe(
        palette.textPrimary,
      );
      expect(title.props.allowFontScaling).not.toBe(false);
      expect(StyleSheet.flatten(title.props.style).writingDirection).toBe(
        'rtl',
      );
    },
  );
  it('does not animate with reduced motion', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await render(<Success />);
    expect(timing).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'عرض خدماتي' })).toBeTruthy();
  });
  it('runs entrance once without replay on unrelated renders', async () => {
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockResolvedValue(false);
    const timing = jest.spyOn(Animated, 'timing');
    const { rerender } = await render(<Success />);
    const count = timing.mock.calls.length;
    expect(count).toBeGreaterThan(0);
    await rerender(<Success />);
    expect(timing).toHaveBeenCalledTimes(count);
  });
  it('does not show a fake pending card for a guest', async () => {
    jest
      .mocked(useProviderState)
      .mockReturnValue({ userId: null } as ReturnType<typeof useProviderState>);
    await render(<Success />);
    expect(screen.getByText('مفيش طلب مسجل في الجلسة دي')).toBeTruthy();
    expect(screen.queryByText('قيد المراجعة')).toBeNull();
    expect(screen.queryByTestId('animated-success-check')).toBeNull();
  });
  it('does not show a fake pending state for a signed-in account without the submitted request', async () => {
    jest.mocked(useProviderState).mockReturnValue({
      userId: 'owner',
      requests: [],
    } as unknown as ReturnType<typeof useProviderState>);
    await render(<Success />);
    expect(screen.queryByText('طلبك وصلنا!')).toBeNull();
    expect(screen.queryByText('حالة الطلب الحالية')).toBeNull();
  });
  it('announces a confirmed submission only once', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { rerender } = await render(<Success />);
    expect(announce).toHaveBeenCalledWith(
      'طلبك وصلنا وهو دلوقتي مستني المراجعة.',
    );
    await rerender(<Success />);
    expect(announce).toHaveBeenCalledTimes(1);
  });
  it.each([
    {
      configured: false,
      userId: 'owner',
      requests: [
        {
          providerId: 'submitted-provider',
          ownerId: 'owner',
          status: 'pending',
        },
      ],
    },
    {
      configured: true,
      userId: 'owner',
      requests: [
        {
          providerId: 'submitted-provider',
          ownerId: 'someone-else',
          status: 'pending',
        },
      ],
    },
    { configured: true, userId: 'owner', requests: [] },
  ])('never celebrates an unconfirmed or foreign request', async (state) => {
    jest
      .mocked(useProviderState)
      .mockReturnValue(state as ReturnType<typeof useProviderState>);
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await render(<Success />);
    expect(
      screen.queryByTestId('animated-success-check', {
        includeHiddenElements: true,
      }),
    ).toBeNull();
    expect(announce).not.toHaveBeenCalled();
  });
});
