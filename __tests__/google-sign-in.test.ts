import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signInWithPopup,
  signInWithCredential,
  type Auth,
  type User,
  type UserCredential,
} from '@firebase/auth';
import {
  googleSignIn as webSignIn,
  googleSignOut as webSignOut,
  reauthenticateGoogle as webReauthenticate,
} from '../src/features/auth/googleSignIn.web';
import {
  googleSignIn as nativeSignIn,
  googleSignOut as nativeSignOut,
  reauthenticateGoogle as nativeReauthenticate,
} from '../src/features/auth/googleSignIn.native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
jest.mock('@firebase/auth', () => ({
  GoogleAuthProvider: Object.assign(jest.fn(), {
    credential: jest.fn(() => 'credential'),
  }),
  signInWithPopup: jest.fn(),
  reauthenticateWithPopup: jest.fn(),
  signInWithCredential: jest.fn(),
  reauthenticateWithCredential: jest.fn(),
}));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(async () => null),
  },
}));
const auth = {} as Auth;
const currentUser = { uid: 'google-user' } as User;
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
  it('reauthenticates on web via popup, treats cancel as null and propagates mismatches', async () => {
    jest.mocked(reauthenticateWithPopup).mockResolvedValue(credential);
    expect(await webReauthenticate(currentUser)).toBe(credential);
    expect(reauthenticateWithPopup).toHaveBeenCalledWith(
      currentUser,
      expect.anything(),
    );

    jest
      .mocked(reauthenticateWithPopup)
      .mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' });
    expect(await webReauthenticate(currentUser)).toBeNull();

    jest
      .mocked(reauthenticateWithPopup)
      .mockRejectedValueOnce({ code: 'auth/user-mismatch' });
    await expect(webReauthenticate(currentUser)).rejects.toEqual({
      code: 'auth/user-mismatch',
    });
    await expect(webSignOut()).resolves.toBeUndefined();
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
  it('reauthenticates natively by signing out first, handles cancellation, and cleans up on googleSignOut', async () => {
    jest.mocked(GoogleSignin.signIn).mockResolvedValueOnce({
      type: 'success',
      data: { idToken: 'fresh-google-token' },
    } as Awaited<ReturnType<typeof GoogleSignin.signIn>>);
    jest.mocked(reauthenticateWithCredential).mockResolvedValueOnce(credential);

    expect(await nativeReauthenticate(currentUser)).toBe(credential);
    expect(GoogleSignin.signOut).toHaveBeenCalledTimes(1);
    expect(GoogleAuthProvider.credential).toHaveBeenCalledWith(
      'fresh-google-token',
    );
    expect(reauthenticateWithCredential).toHaveBeenCalledWith(
      currentUser,
      'credential' as unknown as ReturnType<typeof GoogleAuthProvider.credential>,
    );

    jest.mocked(GoogleSignin.signIn).mockResolvedValueOnce({
      type: 'cancelled',
      data: null,
    });
    expect(await nativeReauthenticate(currentUser)).toBeNull();
    expect(reauthenticateWithCredential).toHaveBeenCalledTimes(1);

    await nativeSignOut();
    expect(GoogleSignin.signOut).toHaveBeenCalledTimes(3);

    delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    await expect(nativeSignOut()).resolves.toBeUndefined();
  });
});
