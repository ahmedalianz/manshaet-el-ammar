import { clearUserDrafts } from '../local/drafts';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onIdTokenChanged,
  getIdTokenResult,
  updateProfile,
  type User,
} from '@firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from '@firebase/firestore';
import { auth } from '../../lib/firebase/auth';
import { db } from '../../lib/firebase/firestore';
import { firebaseConfigurationMessage } from '../../lib/firebase/config';
import { googleSignIn } from './googleSignIn';
import { authErrorMessage } from './errors';

type AuthState = {
  user: User | null;
  initializing: boolean;
  configured: boolean;
  error: string | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInGoogle: () => Promise<boolean>;
  resetPassword: (email: string) => Promise<void>;
};
const Context = createContext<AuthState | null>(null);
async function ensureProfile(user: User, name?: string) {
  if (!db) throw new Error('Firebase unavailable');
  const reference = doc(db, 'users', user.uid);
  const profile = await getDoc(reference);
  if (!profile.exists())
    await setDoc(reference, {
      displayName: name || user.displayName || 'مستخدم',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(Boolean(auth));
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(
    auth ? null : firebaseConfigurationMessage,
  );
  useEffect(() => {
    if (!auth) return;
    let active = true;
    let version = 0;
    let previousUid = auth.currentUser?.uid;
    const clearPreviousDrafts = (nextUid?: string) => {
      if (previousUid && previousUid !== nextUid) {
        void clearUserDrafts(previousUid).catch(() => {
          if (active)
            setError(
              'مش قادرين نمسح المسودات من الجهاز. جرّب تسجيل الدخول والخروج تاني.',
            );
        });
      }
      previousUid = nextUid;
    };
    const unsubscribe = onIdTokenChanged(
      auth,
      (nextUser) => {
        const currentVersion = ++version;
        clearPreviousDrafts(nextUser?.uid);
        setUser(nextUser);
        setIsAdmin(false);
        if (!nextUser) {
          setInitializing(false);
          return;
        }
        setInitializing(true);
        void getIdTokenResult(nextUser)
          .then((token) => {
            if (active && version === currentVersion)
              setIsAdmin(token.claims.admin === true);
          })
          .catch((cause) => {
            if (active && version === currentVersion)
              setError(authErrorMessage(cause));
          })
          .finally(() => {
            if (active && version === currentVersion) setInitializing(false);
          });
      },
      (cause) => {
        if (active) {
          version += 1;
          clearPreviousDrafts();
          setUser(null);
          setIsAdmin(false);
          setInitializing(false);
          setError(authErrorMessage(cause));
        }
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  const requireAuth = () => {
    if (!auth) throw new Error(firebaseConfigurationMessage);
    return auth;
  };
  const signIn = async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(
      requireAuth(),
      email.trim(),
      password,
    );
    // Auth may succeed before a profile write. A later sign-in retries a missing profile.
    await ensureProfile(credential.user);
    setError(null);
  };
  const signInGoogle = async () => {
    const credential = await googleSignIn(requireAuth());
    if (!credential) return false;
    await ensureProfile(credential.user);
    setError(null);
    return true;
  };
  const register = async (name: string, email: string, password: string) => {
    const credential = await createUserWithEmailAndPassword(
      requireAuth(),
      email.trim(),
      password,
    );
    try {
      await updateProfile(credential.user, { displayName: name.trim() });
      await ensureProfile(credential.user, name.trim());
    } catch {
      throw Object.assign(new Error('Profile synchronization failed'), {
        code: 'auth/profile-sync-failed',
      });
    }
    setError(null);
  };
  const signOut = async () => {
    const client = requireAuth();
    if (client.currentUser) {
      try {
        await clearUserDrafts(client.currentUser.uid);
      } catch {
        throw Object.assign(new Error('Draft cleanup failed'), {
          code: 'local/draft-cleanup',
        });
      }
    }
    await firebaseSignOut(client);
    setError(null);
  };
  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(requireAuth(), email.trim());
  };
  return (
    <Context.Provider
      value={{
        user,
        initializing,
        configured: Boolean(auth && db),
        error,
        isAdmin,
        signIn,
        register,
        signInGoogle,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}
