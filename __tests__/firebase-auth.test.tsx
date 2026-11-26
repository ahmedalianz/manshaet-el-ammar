import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import {
  EmailAuthProvider,
  deleteUser,
  getIdTokenResult,
  onIdTokenChanged,
  reauthenticateWithCredential,
  signOut,
  type User,
  type IdTokenResult,
  type UserCredential,
} from '@firebase/auth';
import { saveDraft, readDraft } from '../src/features/local/drafts';
import { AuthProvider, useAuth } from '../src/features/auth/AuthProvider';
import { auth as mockAuth } from '../src/lib/firebase/auth';
import {
  googleSignOut,
  reauthenticateGoogle,
} from '../src/features/auth/googleSignIn';
import { requestAccountDataDeletion } from '../src/features/account/deleteAccount';
import { localDirectory } from '../src/features/local/LocalDirectory';
import { queryClient } from '../src/lib/query-client';
import { notifyClaimsChanged } from '../src/features/claims/useServiceClaims';

jest.mock('../src/lib/firebase/auth', () => ({
  auth: { currentUser: null },
}));
jest.mock('../src/lib/firebase/firestore', () => ({ db: {} }));
jest.mock('../src/lib/firebase/config', () => ({
  firebaseConfigurationMessage: 'Firebase unavailable',
}));
jest.mock('../src/features/auth/googleSignIn', () => ({
  googleSignIn: jest.fn(),
  reauthenticateGoogle: jest.fn(),
  googleSignOut: jest.fn(async () => undefined),
}));
jest.mock('../src/features/account/deleteAccount', () => ({
  requestAccountDataDeletion: jest.fn(),
}));
jest.mock('../src/features/claims/useServiceClaims', () => ({
  notifyClaimsChanged: jest.fn(),
}));
jest.mock('@firebase/auth', () => ({
  EmailAuthProvider: {
    credential: jest.fn((email: string, password: string) => ({
      email,
      password,
    })),
  },
  onIdTokenChanged: jest.fn(),
  getIdTokenResult: jest.fn(),
  signOut: jest.fn(),
  deleteUser: jest.fn(),
  reauthenticateWithCredential: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  updateProfile: jest.fn(),
}));
jest.mock('@firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(),
}));

const token = (admin: boolean) =>
  ({ claims: { admin } }) as unknown as IdTokenResult;
const user = (uid: string, email = `${uid}@example.test`) =>
  ({ uid, email }) as User;
let observe: (value: User | null) => void;
let observerError: (error: Error) => void;
const unsubscribe = jest.fn();
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  (mockAuth as unknown as { currentUser: User | null }).currentUser = null;
  jest.mocked(onIdTokenChanged).mockImplementation((_auth, next, error) => {
    observe = next as (value: User | null) => void;
    observerError = error as (error: Error) => void;
    return unsubscribe;
  });
  jest.mocked(getIdTokenResult).mockResolvedValue(token(false));
  jest.mocked(signOut).mockResolvedValue(undefined);
  jest.mocked(deleteUser).mockResolvedValue(undefined);
  jest.mocked(reauthenticateWithCredential).mockResolvedValue({} as UserCredential);
  jest.mocked(reauthenticateGoogle).mockResolvedValue({} as UserCredential);
  jest.mocked(googleSignOut).mockResolvedValue(undefined);
  jest.mocked(requestAccountDataDeletion).mockResolvedValue({
    deletedProviderIds: [],
  });
});

describe('Firebase Auth observer session lifecycle', () => {
  it('clears private drafts when an authenticated session is lost through an observer error', async () => {
    await saveDraft('cleanup-owner', 'new', {
      values: {
        name: 'مسودة',
        categoryId: 'plumbing',
        serviceTitle: 'سباك',
        description: '',
        phone: '01012345678',
        address: 'شارع المدرسة',
      },
      step: 1,
      sameNumber: false,
      savedAt: new Date().toISOString(),
    });
    await renderHook(useAuth, { wrapper: AuthProvider });
    await act(async () => observe(user('cleanup-owner')));
    expect(await readDraft('cleanup-owner', 'new')).not.toBeNull();
    await act(async () => observerError(new Error('deleted session')));
    expect(await readDraft('cleanup-owner', 'new')).toBeNull();
  });
  it('waits for persisted session restoration and trusts only the admin claim', async () => {
    const { result, unmount } = await renderHook(useAuth, {
      wrapper: AuthProvider,
    });
    expect(result.current.initializing).toBe(true);
    expect(result.current.user).toBeNull();
    await act(async () => {
      observe(user('restored'));
    });
    expect(result.current.user?.uid).toBe('restored');
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.initializing).toBe(false);
    await unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('clears a signed-in session only when Firebase emits the sign-out', async () => {
    const { result } = await renderHook(useAuth, { wrapper: AuthProvider });
    await act(async () => {
      observe(user('owner'));
    });
    await act(async () => {
      await result.current.signOut();
    });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(result.current.user?.uid).toBe('owner');
    await act(async () => {
      observe(null);
    });
    expect(result.current.user).toBeNull();
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.initializing).toBe(false);
  });

  it('updates admin access when the same account receives a refreshed token', async () => {
    const current = user('same-user');
    jest
      .mocked(getIdTokenResult)
      .mockResolvedValueOnce(token(false))
      .mockResolvedValueOnce(token(true));
    const { result } = await renderHook(useAuth, { wrapper: AuthProvider });
    await act(async () => {
      observe(current);
    });
    expect(result.current.isAdmin).toBe(false);
    await act(async () => {
      observe(current);
    });
    expect(result.current.isAdmin).toBe(true);
  });

  it('ignores stale admin claims from a previous account', async () => {
    const oldClaims = deferred<IdTokenResult>();
    jest.mocked(getIdTokenResult).mockReturnValueOnce(oldClaims.promise);
    const { result } = await renderHook(useAuth, { wrapper: AuthProvider });
    await act(async () => {
      observe(user('old-admin'));
    });
    expect(result.current.initializing).toBe(true);
    await act(async () => {
      observe(user('new-owner'));
    });
    expect(result.current.user?.uid).toBe('new-owner');
    expect(result.current.isAdmin).toBe(false);
    await act(async () => {
      oldClaims.resolve(token(true));
    });
    expect(result.current.user?.uid).toBe('new-owner');
    expect(result.current.isAdmin).toBe(false);
  });

  it('does not restore stale admin privileges after logout', async () => {
    const oldClaims = deferred<IdTokenResult>();
    jest.mocked(getIdTokenResult).mockReturnValueOnce(oldClaims.promise);
    const { result } = await renderHook(useAuth, { wrapper: AuthProvider });
    await act(async () => {
      observe(user('admin'));
      observe(null);
    });
    await act(async () => {
      oldClaims.resolve(token(true));
    });
    expect(result.current.user).toBeNull();
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.initializing).toBe(false);
  });

  it('fails closed when claims or session restoration fail', async () => {
    jest
      .mocked(getIdTokenResult)
      .mockRejectedValueOnce({ code: 'auth/network-request-failed' });
    const { result } = await renderHook(useAuth, { wrapper: AuthProvider });
    await act(async () => {
      observe(user('unknown-role'));
    });
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.initializing).toBe(false);
    expect(result.current.error).toContain('الاتصال');
    await act(async () => {
      observerError(new Error('session failure'));
    });
    expect(result.current.user).toBeNull();
    expect(result.current.isAdmin).toBe(false);
  });

  it('invalidates pending claims when the auth observer errors', async () => {
    const oldClaims = deferred<IdTokenResult>();
    jest.mocked(getIdTokenResult).mockReturnValueOnce(oldClaims.promise);
    const { result } = await renderHook(useAuth, { wrapper: AuthProvider });
    await act(async () => {
      observe(user('admin'));
    });
    await act(async () => {
      observerError(new Error('session failed'));
    });
    await act(async () => {
      oldClaims.resolve(token(true));
    });
    expect(result.current.user).toBeNull();
    expect(result.current.isAdmin).toBe(false);
  });
});

describe('immediate account deletion', () => {
  it('reauthenticates with password, deletes backend data, drafts, Auth user and public caches', async () => {
    const current = user('delete-owner', 'owner@example.test');
    (mockAuth as unknown as { currentUser: User | null }).currentUser = current;
    await saveDraft('delete-owner', 'new', {
      values: {
        name: 'مسودة',
        categoryId: 'plumbing',
        serviceTitle: 'سباك',
        description: '',
        phone: '01012345678',
        address: 'شارع المدرسة',
      },
      step: 1,
      sameNumber: false,
      savedAt: new Date().toISOString(),
    });
    jest.mocked(requestAccountDataDeletion).mockResolvedValue({
      deletedProviderIds: ['srv-1'],
    });
    const markSpy = jest
      .spyOn(localDirectory, 'markUnavailable')
      .mockImplementation(() => {});
    const invalidateSpy = jest
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue();

    const { result } = await renderHook(useAuth, { wrapper: AuthProvider });
    await act(async () => observe(current));

    let response!: { deleted: boolean; deletedProviderIds: string[] };
    await act(async () => {
      response = await result.current.deleteAccount({
        method: 'password',
        password: 'secret-password',
      });
    });

    expect(response).toEqual({ deleted: true, deletedProviderIds: ['srv-1'] });
    expect(EmailAuthProvider.credential).toHaveBeenCalledWith(
      'owner@example.test',
      'secret-password',
    );
    expect(reauthenticateWithCredential).toHaveBeenCalledWith(
      current,
      expect.objectContaining({
        email: 'owner@example.test',
        password: 'secret-password',
      }),
    );
    expect(requestAccountDataDeletion).toHaveBeenCalledWith(current);
    expect(await readDraft('delete-owner', 'new')).toBeNull();
    expect(deleteUser).toHaveBeenCalledWith(current);
    expect(googleSignOut).toHaveBeenCalledTimes(1);
    expect(markSpy).toHaveBeenCalledWith('srv-1');
    expect(notifyClaimsChanged).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['public'] });
    markSpy.mockRestore();
    invalidateSpy.mockRestore();
  });

  it('aborts cleanly when Google reauthentication is cancelled', async () => {
    const current = user('google-owner');
    (mockAuth as unknown as { currentUser: User | null }).currentUser = current;
    jest.mocked(reauthenticateGoogle).mockResolvedValue(null);

    const { result } = await renderHook(useAuth, { wrapper: AuthProvider });
    await act(async () => observe(current));

    let response!: { deleted: boolean; deletedProviderIds: string[] };
    await act(async () => {
      response = await result.current.deleteAccount({ method: 'google' });
    });

    expect(response).toEqual({ deleted: false, deletedProviderIds: [] });
    expect(requestAccountDataDeletion).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('aborts before backend or Auth deletion when password reauthentication fails', async () => {
    const current = user('bad-pass');
    (mockAuth as unknown as { currentUser: User | null }).currentUser = current;
    jest
      .mocked(reauthenticateWithCredential)
      .mockRejectedValue({ code: 'auth/invalid-credential' });

    const { result } = await renderHook(useAuth, { wrapper: AuthProvider });
    await act(async () => observe(current));

    await act(async () => {
      await expect(
        result.current.deleteAccount({ method: 'password', password: 'wrong' }),
      ).rejects.toMatchObject({ code: 'auth/invalid-credential' });
    });
    expect(requestAccountDataDeletion).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('blocks admin accounts before reauthentication or backend calls', async () => {
    const current = user('admin-user');
    (mockAuth as unknown as { currentUser: User | null }).currentUser = current;
    jest.mocked(getIdTokenResult).mockResolvedValue(token(true));

    const { result } = await renderHook(useAuth, { wrapper: AuthProvider });
    await act(async () => observe(current));

    await act(async () => {
      await expect(
        result.current.deleteAccount({ method: 'password', password: 'pw' }),
      ).rejects.toMatchObject({ code: 'account/admin-cannot-delete' });
    });
    expect(reauthenticateWithCredential).not.toHaveBeenCalled();
    expect(requestAccountDataDeletion).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('does not delete the Firebase Auth user if backend data deletion fails', async () => {
    const current = user('backend-fail');
    (mockAuth as unknown as { currentUser: User | null }).currentUser = current;
    jest
      .mocked(requestAccountDataDeletion)
      .mockRejectedValue({ code: 'unavailable' });

    const { result } = await renderHook(useAuth, { wrapper: AuthProvider });
    await act(async () => observe(current));

    await act(async () => {
      await expect(
        result.current.deleteAccount({ method: 'password', password: 'pw' }),
      ).rejects.toMatchObject({ code: 'unavailable' });
    });
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
