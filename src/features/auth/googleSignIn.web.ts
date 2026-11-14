import {
  GoogleAuthProvider,
  signInWithPopup,
  type Auth,
  type UserCredential,
} from '@firebase/auth';

export async function googleSignIn(auth: Auth): Promise<UserCredential | null> {
  try {
    return await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error.code === 'auth/popup-closed-by-user' ||
        error.code === 'auth/cancelled-popup-request')
    )
      return null;
    throw error;
  }
}
