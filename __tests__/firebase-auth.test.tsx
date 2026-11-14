import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import {
  getIdTokenResult,
  onIdTokenChanged,
  signOut,
  type User,
  type IdTokenResult,
} from '@firebase/auth';
import { saveDraft, readDraft } from '../src/features/local/drafts';
import { AuthProvider, useAuth } from '../src/features/auth/AuthProvider';

jest.mock('../src/lib/firebase/auth', () => ({ auth: {} }));
jest.mock('../src/lib/firebase/firestore', () => ({ db: {} }));
jest.mock('../src/lib/firebase/config', () => ({
  firebaseConfigurationMessage: 'Firebase unavailable',
}));
jest.mock('@firebase/auth', () => ({
  onIdTokenChanged: jest.fn(),
  getIdTokenResult: jest.fn(),
  signOut: jest.fn(),
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
const user = (uid: string) => ({ uid }) as User;
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
  jest.mocked(onIdTokenChanged).mockImplementation((_auth, next, error) => {
    observe = next as (value: User | null) => void;
    observerError = error as (error: Error) => void;
    return unsubscribe;
  });
  jest.mocked(getIdTokenResult).mockResolvedValue(token(false));
  jest.mocked(signOut).mockResolvedValue(undefined);
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
        address: 'شارع المدارس',
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
