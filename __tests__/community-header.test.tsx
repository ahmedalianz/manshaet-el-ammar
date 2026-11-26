import { afterEach, expect, it, jest } from '@jest/globals';
import {
  AccessibilityInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import { act, renderHook } from '@testing-library/react-native';
import { render, screen } from './helpers/render';
import { CommunityHeader } from '../src/components/brand/CommunityHeader';
import { useCompactHeader } from '../src/components/brand/useCompactHeader';

afterEach(() => {
  jest.restoreAllMocks();
});

it('animates collapse and expansion while keeping the account action available', async () => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
  const timing = jest.spyOn(Reanimated, 'withTiming');
  const onAccount = jest.fn();
  const view = await render(<CommunityHeader signedIn onAccount={onAccount} />);
  await view.rerender(
    <CommunityHeader signedIn compact onAccount={onAccount} />,
  );
  expect(timing).toHaveBeenLastCalledWith(
    1,
    expect.objectContaining({ duration: 220 }),
  );
  expect(screen.getByRole('button', { name: 'الملف الشخصي' })).toBeTruthy();
  expect(screen.queryByText('بلدنا أقرب')).toBeNull();
  await view.rerender(<CommunityHeader signedIn onAccount={onAccount} />);
  expect(timing).toHaveBeenLastCalledWith(
    0,
    expect.objectContaining({ duration: 180 }),
  );
  expect(screen.getByText('بلدنا أقرب')).toBeTruthy();
});

it('honors reduced motion and retains the page heading when compact', async () => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  const timing = jest.spyOn(Reanimated, 'withTiming');
  const view = await render(
    <CommunityHeader
      signedIn={false}
      pageTitle="المزيد"
      onAccount={() => {}}
    />,
  );
  await view.rerender(
    <CommunityHeader
      signedIn={false}
      compact
      pageTitle="المزيد"
      onAccount={() => {}}
    />,
  );
  expect(timing).not.toHaveBeenCalled();
  expect(screen.getByRole('header', { name: 'المزيد' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'تسجيل الدخول' })).toBeTruthy();
});

it('tracks continuous scrollY offsets in useCompactHeader without oscillating compact state between 20 and 48', async () => {
  const shared = Reanimated.useSharedValue(0);
  jest
    .spyOn(Reanimated, 'useSharedValue')
    .mockReturnValue(shared as Reanimated.SharedValue<unknown>);
  const { result } = await renderHook(() => useCompactHeader());
  const scrollEvent = (y: number) =>
    ({
      nativeEvent: { contentOffset: { x: 0, y } },
    }) as unknown as NativeSyntheticEvent<NativeScrollEvent>;

  expect(result.current.compact).toBe(false);
  expect(result.current.scrollY.value).toBe(0);

  await act(() => {
    result.current.onScroll(scrollEvent(30));
  });
  expect(result.current.scrollY.value).toBe(30);
  expect(result.current.compact).toBe(false);

  await act(() => {
    result.current.onScroll(scrollEvent(60));
  });
  expect(result.current.scrollY.value).toBe(60);
  expect(result.current.compact).toBe(true);

  await act(() => {
    result.current.onScroll(scrollEvent(90));
  });
  expect(result.current.scrollY.value).toBe(90);
  expect(result.current.compact).toBe(true);

  await act(() => {
    result.current.onScroll(scrollEvent(32));
  });
  expect(result.current.scrollY.value).toBe(32);
  expect(result.current.compact).toBe(true);

  await act(() => {
    result.current.onScroll(scrollEvent(16));
  });
  expect(result.current.scrollY.value).toBe(16);
  expect(result.current.compact).toBe(false);
});
