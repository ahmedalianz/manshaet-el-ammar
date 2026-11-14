import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { BackHandler, Platform } from 'react-native';
import { render } from './helpers/render';
import { router } from 'expo-router';
import { AndroidBackBoundary } from '../src/features/navigation/AndroidBackBoundary';
let mockPath = '/';
jest.mock('expo-router', () => ({
  router: { canGoBack: jest.fn(), replace: jest.fn() },
  usePathname: () => mockPath,
}));
let handler: () => boolean | null | undefined;
const remove = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  mockPath = '/';
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.mocked(router.canGoBack).mockReturnValue(false);
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, callback) => {
      handler = () => callback({ type: 'hardwareBackPress', timeStamp: 0 });
      return { remove };
    });
});
afterEach(() => {
  jest.restoreAllMocks();
});
describe('Android back fallback', () => {
  it('consumes back at Home without exiting or navigating', async () => {
    const exit = jest.spyOn(BackHandler, 'exitApp');
    await render(<AndroidBackBoundary />);
    expect(handler()).toBe(true);
    expect(router.replace).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });
  it('allows normal stacked navigation and screen guards to handle Back', async () => {
    mockPath = '/provider/add';
    jest.mocked(router.canGoBack).mockReturnValue(true);
    await render(<AndroidBackBoundary />);
    expect(handler()).toBe(false);
    expect(router.replace).not.toHaveBeenCalled();
  });
  it.each([
    '/explore',
    '/more',
    '/my-services',
    '/provider/add',
    '/provider/sign-in',
    '/provider/success',
    '/account/profile',
    '/admin',
    '/info/privacy',
    '/category/plumbing',
    '/provider/provider-1',
  ])('returns a history-free %s to Home', async (path) => {
    mockPath = path;
    await render(<AndroidBackBoundary />);
    expect(handler()).toBe(true);
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
  });
  it('uses the latest route without reordering hardware listeners and cleans up', async () => {
    const { rerender, unmount } = await render(<AndroidBackBoundary />);
    mockPath = '/info/contact';
    await rerender(<AndroidBackBoundary />);
    expect(BackHandler.addEventListener).toHaveBeenCalledTimes(1);
    handler();
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
  it('does not intercept iOS', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await render(<AndroidBackBoundary />);
    expect(BackHandler.addEventListener).not.toHaveBeenCalled();
  });
});
