import {
  GoogleAuthProvider,
  reauthenticateWithPopup,
  signInWithPopup,
  type Auth,
  type User,
  type UserCredential,
} from '@firebase/auth';

function isPopupCancelled(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'auth/popup-closed-by-user' ||
      error.code === 'auth/cancelled-popup-request')
  );
}

export async function googleSignIn(auth: Auth): Promise<UserCredential | null> {
  try {
    return await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (error) {
    if (isPopupCancelled(error)) return null;
    throw error;
  }
}

export async function reauthenticateGoogle(
  user: User,
): Promise<UserCredential | null> {
  try {
    return await reauthenticateWithPopup(user, new GoogleAuthProvider());
  } catch (error) {
    if (isPopupCancelled(error)) return null;
    throw error;
  }
}

export async function googleSignOut(): Promise<void> {}
