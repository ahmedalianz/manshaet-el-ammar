import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppThemeProvider,
  THEME_STORAGE_KEY,
  useAppTheme,
} from '../src/theme/ThemeProvider';
import { AppearanceSetting } from '../src/theme/AppearanceSetting';
import { colors, darkColors } from '../src/theme/colors';
import {
  ProviderStateProvider,
  useProviderState,
} from './fixtures/MockProviderContext';
import { FormField } from '../src/features/provider/FormField';
import type { ReactNode } from 'react';
jest.mock('../src/features/provider/ProviderContext', () =>
  jest.requireActual('./fixtures/MockProviderContext'),
);

const defaultGet = jest.mocked(AsyncStorage.getItem).getMockImplementation()!;
const defaultSet = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
beforeEach(async () => {
  jest.restoreAllMocks();
  jest.mocked(AsyncStorage.getItem).mockReset().mockImplementation(defaultGet);
  jest.mocked(AsyncStorage.setItem).mockReset().mockImplementation(defaultSet);
  await AsyncStorage.clear();
  jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('light');
  jest
    .spyOn(ReactNative.Appearance, 'setColorScheme')
    .mockImplementation(() => {});
});
const setup = () => renderHook(useAppTheme, { wrapper: AppThemeProvider });

describe('appearance preference and persistence', () => {
  it('defaults to System and resolves System Light to Light', async () => {
    const { result } = await setup();
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.preference).toBe('system');
    expect(result.current.resolved).toBe('light');
    expect(ReactNative.Appearance.setColorScheme).toHaveBeenCalledWith('auto');
  });
  it('resolves System Dark to Dark', async () => {
    jest.mocked(ReactNative.useColorScheme).mockReturnValue('dark');
    const { result } = await setup();
    expect(result.current.resolved).toBe('dark');
    expect(result.current.colors).toBe(darkColors);
  });
  it.each([
    ['light', 'dark'],
    ['dark', 'light'],
  ] as const)('explicit %s overrides system %s', async (choice, system) => {
    jest.mocked(ReactNative.useColorScheme).mockReturnValue(system);
    const { result } = await setup();
    await act(() => result.current.setPreference(choice));
    expect(result.current.resolved).toBe(choice);
    expect(ReactNative.Appearance.setColorScheme).toHaveBeenLastCalledWith(
      choice,
    );
  });
  it('follows OS changes only while System is selected', async () => {
    const { result, rerender } = await setup();
    jest.mocked(ReactNative.useColorScheme).mockReturnValue('dark');
    await rerender({});
    expect(result.current.resolved).toBe('dark');
    await act(() => result.current.setPreference('light'));
    await rerender({});
    expect(result.current.resolved).toBe('light');
    jest.mocked(ReactNative.useColorScheme).mockReturnValue('light');
    await rerender({});
    expect(result.current.preference).toBe('light');
  });
  it('persists the preference and restores it after remount', async () => {
    const first = await setup();
    await act(() => first.result.current.setPreference('dark'));
    await waitFor(async () =>
      expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('dark'),
    );
    await first.unmount();
    const second = await setup();
    await waitFor(() => expect(second.result.current.ready).toBe(true));
    expect(second.result.current.preference).toBe('dark');
    expect(second.result.current.resolved).toBe('dark');
  });
  it('persists System rather than a resolved system scheme', async () => {
    jest.mocked(ReactNative.useColorScheme).mockReturnValue('dark');
    const { result } = await setup();
    await act(() => result.current.setPreference('system'));
    await waitFor(async () =>
      expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('system'),
    );
  });
  it('falls back safely for an invalid persisted preference', async () => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    const { result } = await setup();
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.preference).toBe('system');
  });
  it('finishes restoration safely after a storage read error', async () => {
    jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValue(new Error('Storage unavailable'));
    const { result } = await setup();
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.preference).toBe('system');
    expect(result.current.persistenceError).toBeTruthy();
  });
  it('does not overwrite a new user choice when a stale storage read resolves', async () => {
    let restore: (value: string | null) => void = () => {};
    jest.spyOn(AsyncStorage, 'getItem').mockReturnValue(
      new Promise((resolve) => {
        restore = resolve;
      }),
    );
    const { result } = await setup();
    await act(() => result.current.setPreference('dark'));
    await act(() => restore('light'));
    expect(result.current.preference).toBe('dark');
    expect(result.current.ready).toBe(true);
  });
  it('serializes rapid preference writes so the last choice wins', async () => {
    let complete: () => void = () => {};
    const firstWrite = new Promise<void>((resolve) => {
      complete = resolve;
    });
    const write = jest
      .spyOn(AsyncStorage, 'setItem')
      .mockImplementationOnce(() => firstWrite)
      .mockResolvedValue(undefined);
    const { result } = await setup();
    await act(() => {
      result.current.setPreference('light');
      result.current.setPreference('dark');
    });
    expect(write).toHaveBeenCalledTimes(1);
    await act(() => complete());
    await waitFor(() =>
      expect(write).toHaveBeenLastCalledWith(THEME_STORAGE_KEY, 'dark'),
    );
  });
  it('updates immediately and reports a persistence failure without losing the current choice', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValue(new Error('Full'));
    const { result } = await setup();
    await act(() => result.current.setPreference('dark'));
    expect(result.current.resolved).toBe('dark');
    await waitFor(() => expect(result.current.persistenceError).toBeTruthy());
  });
});

describe('appearance UI and session independence', () => {
  it('allows a guest to choose Dark with an accessible selected state', async () => {
    await render(
      <AppThemeProvider>
        <AppearanceSetting />
      </AppThemeProvider>,
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'داكن' }));
    expect(
      screen.getByRole('radio', { name: 'داكن' }).props.accessibilityState
        .checked,
    ).toBe(true);
    expect(
      screen.getByRole('radio', { name: 'فاتح' }).props.accessibilityState
        .checked,
    ).toBe(false);
    await waitFor(async () =>
      expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('dark'),
    );
  });
  it('preserves appearance across provider/admin switching and sign-out', async () => {
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <AppThemeProvider>
        <ProviderStateProvider>{children}</ProviderStateProvider>
      </AppThemeProvider>
    );
    const { result } = await renderHook(
      () => ({ theme: useAppTheme(), session: useProviderState() }),
      { wrapper: Wrapper },
    );
    await act(() => result.current.theme.setPreference('dark'));
    for (const profile of ['listings', 'admin'] as const) {
      await act(() => result.current.session.signIn(profile));
      expect(result.current.theme.preference).toBe('dark');
    }
    await act(() => result.current.session.signOut());
    expect(result.current.session.role).toBe('guest');
    expect(result.current.theme.preference).toBe('dark');
  });
  it('preserves field RTL/LTR and error accessibility while using a dark keyboard', async () => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, 'dark');
    await render(
      <AppThemeProvider>
        <FormField
          label="رقم التواصل"
          value="01012345678"
          phone
          error="راجع الرقم"
        />
      </AppThemeProvider>,
    );
    await waitFor(() =>
      expect(
        screen.getByLabelText('رقم التواصل').props.keyboardAppearance,
      ).toBe('dark'),
    );
    expect(screen.getByLabelText('رقم التواصل').props.textAlign).toBe('left');
    expect(
      screen.getByLabelText('رقم التواصل').props.allowFontScaling,
    ).not.toBe(false);
    expect(screen.getByText('راجع الرقم').props.accessibilityLiveRegion).toBe(
      'polite',
    );
  });
});

const luminance = (hex: string) =>
  [1, 3, 5]
    .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    )
    .reduce(
      (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
      0,
    );
const contrast = (a: string, b: string) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) /
  (Math.min(luminance(a), luminance(b)) + 0.05);
describe('semantic contrast in both appearances', () => {
  it.each([
    ['Slate Light', colors],
    ['Slate Dark', darkColors],
  ] as const)(
    '%s meets normal text contrast for the actual surfaces and statuses',
    (_name, palette) => {
      const pairs = [
        ['textPrimary', 'background'],
        ['textPrimary', 'surface'],
        ['textSecondary', 'surface'],
        ['textSecondary', 'elevatedSurface'],
        ['textSecondary', 'secondary'],
        ['primaryDark', 'surface'],
        ['primaryDark', 'background'],
        ['warning', 'pendingBackground'],
        ['success', 'publishedBackground'],
        ['error', 'rejectedBackground'],
        ['muted', 'background'],
        ['muted', 'surfaceContainer'],
        ['placeholder', 'inputBackground'],
        ['onPrimary', 'actionBackground'],
        ['onPrimary', 'primary'],
        ['onHero', 'heroBackground'],
        ['onBanner', 'bannerBackground'],
        ['error', 'errorContainer'],
        ['error', 'surface'],
        ['textSecondary', 'publishedBackground'],
        ['textSecondary', 'pendingBackground'],
        ['textSecondary', 'rejectedBackground'],
        ['disabledText', 'disabledBackground'],
        ['primaryDark', 'secondaryAction'],
      ] as const;
      for (const [foreground, background] of pairs)
        expect({
          foreground,
          background,
          ratio: contrast(palette[foreground], palette[background]),
        }).toEqual(expect.objectContaining({ ratio: expect.any(Number) }));
      for (const [foreground, background] of pairs)
        expect(
          contrast(palette[foreground], palette[background]),
        ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(palette.inputBorder, palette.inputBackground),
      ).toBeGreaterThanOrEqual(3);
    },
  );
});

describe('selected Slate identity', () => {
  it.each([
    'emerald',
    'olive',
    'slate',
    'nile',
    'clay',
    'plum',
    'indigo',
    'coffee',
  ])(
    'ignores old palette preference %s while preserving appearance',
    async (previous) => {
      await AsyncStorage.setItem('manshaet-el-ammar.visual-theme', previous);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, 'dark');
      const { result } = await setup();
      await waitFor(() => expect(result.current.ready).toBe(true));
      expect(result.current.colors).toBe(darkColors);
      expect(result.current.colors.primary).toBe('#83B8D6');
      await act(() => result.current.setPreference('light'));
      expect(result.current.colors).toBe(colors);
      expect(result.current.colors.primary).toBe('#28577A');
    },
  );
  it('shows only the System Light and Dark appearance controls', async () => {
    await render(
      <AppThemeProvider>
        <AppearanceSetting />
      </AppThemeProvider>,
    );
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.queryByText('اختار شكل التطبيق')).toBeNull();
  });
});
