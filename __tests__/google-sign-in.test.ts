import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  type Auth,
  type UserCredential,
} from '@firebase/auth';
import { googleSignIn as webSignIn } from '../src/features/auth/googleSignIn.web';
import { googleSignIn as nativeSignIn } from '../src/features/auth/googleSignIn.native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
jest.mock('@firebase/auth', () => ({
  GoogleAuthProvider: Object.assign(jest.fn(), {
    credential: jest.fn(() => 'credential'),
  }),
  signInWithPopup: jest.fn(),
  signInWithCredential: jest.fn(),
}));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
  },
}));
const auth = {} as Auth;
const credential = { user: { uid: 'google-user' } } as UserCredential;
beforeEach(() => {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID =
    'test.apps.googleusercontent.com';
});
describe('Google authentication adapters', () => {
  it('uses Firebase Google popup on web', async () => {
    jest.mocked(signInWithPopup).mockResolvedValue(credential);
    expect(await webSignIn(auth)).toBe(credential);
    expect(signInWithPopup).toHaveBeenCalledWith(auth, expect.anything());
  });
  it('treats closing the popup as cancellation', async () => {
    jest
      .mocked(signInWithPopup)
      .mockRejectedValue({ code: 'auth/popup-closed-by-user' });
    expect(await webSignIn(auth)).toBeNull();
  });
  it('does not swallow web authentication failures', async () => {
    jest
      .mocked(signInWithPopup)
      .mockRejectedValue({ code: 'auth/network-request-failed' });
    await expect(webSignIn(auth)).rejects.toEqual({
      code: 'auth/network-request-failed',
    });
  });
  it('exchanges a native Google ID token with Firebase', async () => {
    jest.mocked(GoogleSignin.signIn).mockResolvedValue({
      type: 'success',
      data: { idToken: 'google-token' },
    } as Awaited<ReturnType<typeof GoogleSignin.signIn>>);
    jest.mocked(signInWithCredential).mockResolvedValue(credential);
    expect(await nativeSignIn(auth)).toBe(credential);
    expect(GoogleSignin.configure).toHaveBeenCalledWith(
      expect.objectContaining({
        webClientId: 'test.apps.googleusercontent.com',
      }),
    );
    expect(GoogleAuthProvider.credential).toHaveBeenCalledWith('google-token');
    expect(signInWithCredential).toHaveBeenCalledWith(auth, expect.anything());
  });
  it('does not authenticate a cancelled native sign-in', async () => {
    jest
      .mocked(GoogleSignin.signIn)
      .mockResolvedValue({ type: 'cancelled', data: null });
    expect(await nativeSignIn(auth)).toBeNull();
    expect(signInWithCredential).not.toHaveBeenCalled();
  });
  it('rejects a missing Google client configuration', async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    await expect(nativeSignIn(auth)).rejects.toMatchObject({
      code: 'auth/google-not-configured',
    });
    expect(GoogleSignin.signIn).not.toHaveBeenCalled();
  });
});
