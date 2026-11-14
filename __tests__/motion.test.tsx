import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from './helpers/render';
import { AccessibilityInfo, Animated, Text } from 'react-native';
import { MotionPressable, MotionReveal } from '../src/components/ui/Motion';

beforeEach(() => {
  jest.restoreAllMocks();
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
  jest
    .spyOn(Animated, 'spring')
    .mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
  jest
    .spyOn(Animated, 'timing')
    .mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
});

describe('shared press motion', () => {
  it('preserves callbacks, label, role, ripple and hit slop without delaying the action', async () => {
    const press = jest.fn(),
      pressIn = jest.fn(),
      pressOut = jest.fn();
    await render(
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel="تنفيذ"
        hitSlop={4}
        android_ripple={{ color: '#eee' }}
        onPress={press}
        onPressIn={pressIn}
        onPressOut={pressOut}
      >
        <Text>تنفيذ</Text>
      </MotionPressable>,
    );
    const button = screen.getByRole('button', { name: 'تنفيذ' });
    expect(button.props.hitSlop).toBe(4);
    await fireEvent(button, 'pressIn', {});
    expect(pressIn).toHaveBeenCalledTimes(1);
    expect(Animated.timing).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        toValue: 0.985,
        duration: 110,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    await fireEvent(button, 'pressOut', {});
    expect(pressOut).toHaveBeenCalledTimes(1);
    expect(Animated.spring).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ toValue: 1, speed: 40, useNativeDriver: true }),
    );
    await fireEvent.press(button);
    expect(press).toHaveBeenCalledTimes(1);
  });
  it('keeps disabled controls still and suppresses actions', async () => {
    const press = jest.fn();
    await render(
      <MotionPressable
        disabled
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        onPress={press}
      >
        <Text>غير متاح</Text>
      </MotionPressable>,
    );
    const button = screen.getByRole('button');
    await fireEvent(button, 'pressIn', {});
    await fireEvent.press(button);
    expect(Animated.timing).not.toHaveBeenCalled();
    expect(press).not.toHaveBeenCalled();
    expect(button.props.accessibilityState.disabled).toBe(true);
  });
  it('respects reduced motion while keeping actions immediate', async () => {
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockResolvedValue(true);
    const press = jest.fn();
    await render(
      <MotionPressable accessibilityRole="button" onPress={press}>
        <Text>اضغط</Text>
      </MotionPressable>,
    );
    await fireEvent(screen.getByRole('button'), 'pressIn', {});
    await fireEvent.press(screen.getByRole('button'));
    expect(Animated.timing).not.toHaveBeenCalled();
    expect(press).toHaveBeenCalledTimes(1);
  });
  it('does not animate before the system preference is known', async () => {
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockReturnValue(new Promise(() => {}));
    await render(
      <MotionPressable accessibilityRole="button">
        <Text>اضغط</Text>
      </MotionPressable>,
    );
    await fireEvent(screen.getByRole('button'), 'pressIn', {});
    expect(Animated.timing).not.toHaveBeenCalled();
  });
  it('responds to live reduced-motion updates and removes its listener', async () => {
    const listen = jest.spyOn(AccessibilityInfo, 'addEventListener');
    const { unmount } = await render(
      <MotionPressable accessibilityRole="button">
        <Text>اضغط</Text>
      </MotionPressable>,
    );
    const call = listen.mock.calls.find(
      ([name]) => name === 'reduceMotionChanged',
    )!;
    const changed = call[1] as (enabled: boolean) => void;
    await act(() => changed(true));
    await fireEvent(screen.getByRole('button'), 'pressIn', {});
    expect(Animated.timing).not.toHaveBeenCalled();
    const subscription = listen.mock.results.find(
      (result) => result.type === 'return',
    )?.value;
    if (!subscription) throw new Error('Missing reduced-motion subscription');
    const remove = jest.spyOn(subscription, 'remove');
    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
  it('animates selection once and does not replay for unrelated renders', async () => {
    const { rerender } = await render(
      <MotionPressable
        accessibilityRole="tab"
        accessibilityState={{ selected: false }}
      >
        <Text>طلبات</Text>
      </MotionPressable>,
    );
    expect(Animated.timing).not.toHaveBeenCalled();
    await rerender(
      <MotionPressable
        accessibilityRole="tab"
        accessibilityState={{ selected: true }}
      >
        <Text>طلبات</Text>
      </MotionPressable>,
    );
    expect(Animated.timing).toHaveBeenCalledTimes(1);
    expect(Animated.timing).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ duration: 170, useNativeDriver: true }),
    );
    await rerender(
      <MotionPressable
        accessibilityRole="tab"
        accessibilityState={{ selected: true }}
      >
        <Text>طلبات جديدة</Text>
      </MotionPressable>,
    );
    expect(Animated.timing).toHaveBeenCalledTimes(1);
  });
});

describe('targeted content feedback', () => {
  it('reveals only when the semantic change key changes, never on unrelated content updates', async () => {
    const { rerender } = await render(
      <MotionReveal changeKey="pending">
        <Text>قيد المراجعة</Text>
      </MotionReveal>,
    );
    expect(Animated.timing).not.toHaveBeenCalled();
    await rerender(
      <MotionReveal changeKey="approved">
        <Text>منشورة</Text>
      </MotionReveal>,
    );
    expect(Animated.timing).toHaveBeenCalledTimes(1);
    expect(Animated.timing).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ duration: 210, useNativeDriver: true }),
    );
    await rerender(
      <MotionReveal changeKey="approved">
        <Text>منشورة حاليًا</Text>
      </MotionReveal>,
    );
    expect(Animated.timing).toHaveBeenCalledTimes(1);
  });
  it('supports a single restrained success entrance', async () => {
    await render(
      <MotionReveal animateOnMount duration={240}>
        <Text>تم</Text>
      </MotionReveal>,
    );
    expect(Animated.timing).toHaveBeenCalledTimes(1);
    expect(Animated.timing).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ duration: 240 }),
    );
  });
  it('keeps content visible and static when reduced motion is enabled', async () => {
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockResolvedValue(true);
    const { rerender } = await render(
      <MotionReveal changeKey={1} animateOnMount slide={6}>
        <Text>الخطوة الأولى</Text>
      </MotionReveal>,
    );
    await rerender(
      <MotionReveal changeKey={2} animateOnMount slide={-6}>
        <Text>الخطوة الثانية</Text>
      </MotionReveal>,
    );
    expect(screen.getByText('الخطوة الثانية')).toBeTruthy();
    expect(Animated.timing).not.toHaveBeenCalled();
  });
});
