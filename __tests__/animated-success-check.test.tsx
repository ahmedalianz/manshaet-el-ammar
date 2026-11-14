import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as ReactNative from 'react-native';
import { AccessibilityInfo, processColor } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import { act, render, screen } from './helpers/render';
import { AnimatedSuccessCheck } from '../src/components/ui/AnimatedSuccessCheck';
import { colors, darkColors } from '../src/theme/colors';
const node = (id: string) =>
  screen.getByTestId(id, { includeHiddenElements: true });
beforeEach(() => {
  jest.restoreAllMocks();
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
  jest.spyOn(Reanimated, 'withTiming');
  jest.spyOn(Reanimated, 'withSpring');
  jest.spyOn(Reanimated, 'cancelAnimation');
});
describe('animated success artwork', () => {
  it('plays once per mount and cancels its sequence when leaving', async () => {
    const { rerender, unmount } = await render(<AnimatedSuccessCheck />);
    expect(Reanimated.withTiming).toHaveBeenCalledTimes(3);
    await rerender(<AnimatedSuccessCheck />);
    expect(Reanimated.withTiming).toHaveBeenCalledTimes(3);
    await unmount();
    expect(Reanimated.cancelAnimation).toHaveBeenCalled();
    await render(<AnimatedSuccessCheck />);
    expect(Reanimated.withTiming).toHaveBeenCalledTimes(6);
  });
  it('renders the completed static strokes under reduced motion', async () => {
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockResolvedValue(true);
    await render(<AnimatedSuccessCheck />);
    expect(Reanimated.withTiming).not.toHaveBeenCalled();
    expect(Reanimated.withSpring).not.toHaveBeenCalled();
    expect(node('success-check-stroke').props.strokeDashoffset ?? 0).toBe(0);
  });
  it('does not draw before the preference is known', async () => {
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockReturnValue(new Promise(() => {}));
    await render(<AnimatedSuccessCheck />);
    expect(Reanimated.withTiming).not.toHaveBeenCalled();
    expect(node('success-check-stroke').props.strokeDashoffset ?? 0).toBe(0);
  });
  it('settles immediately when reduced motion is enabled while playing', async () => {
    const listener = jest.spyOn(AccessibilityInfo, 'addEventListener');
    await render(<AnimatedSuccessCheck />);
    const handler = listener.mock.calls.find(
      ([event]) => event === 'reduceMotionChanged',
    )![1] as (value: boolean) => void;
    await act(() => handler(true));
    expect(Reanimated.cancelAnimation).toHaveBeenCalled();
    expect(node('success-check-stroke').props.strokeDashoffset ?? 0).toBe(0);
  });
  it.each([
    ['light', colors],
    ['dark', darkColors],
  ] as const)(
    'uses %s success tokens without mirroring the check',
    async (scheme, palette) => {
      jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(scheme);
      jest
        .mocked(AccessibilityInfo.isReduceMotionEnabled)
        .mockResolvedValue(true);
      await render(<AnimatedSuccessCheck />);
      expect(node('success-fill').props.fill).toEqual({
        type: 0,
        payload: processColor(palette.success),
      });
      expect(node('success-check-stroke').props.stroke).toEqual({
        type: 0,
        payload: processColor(palette.onPrimary),
      });
      expect(node('success-check-stroke').props.d).toBe('M55 74 L68 87 L94 60');
    },
  );
});
