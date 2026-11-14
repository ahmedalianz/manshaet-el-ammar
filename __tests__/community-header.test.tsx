import { afterEach, expect, it, jest } from '@jest/globals';
import { AccessibilityInfo } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import { render, screen } from './helpers/render';
import { CommunityHeader } from '../src/components/brand/CommunityHeader';

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
