import {
  GoogleAuthProvider,
  signInWithCredential,
  type Auth,
  type UserCredential,
} from '@firebase/auth';

export async function googleSignIn(auth: Auth): Promise<UserCredential | null> {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId)
    throw Object.assign(new Error('Google client is not configured'), {
      code: 'auth/google-not-configured',
    });
  let google;
  try {
    // Load on demand so Expo Go can still use email/password without this native module.
    google =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
  } catch {
    throw Object.assign(
      new Error('Google Sign-In requires a development build'),
      { code: 'auth/google-native-unavailable' },
    );
  }
  google.GoogleSignin.configure({
    webClientId,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
  await google.GoogleSignin.hasPlayServices({
    showPlayServicesUpdateDialog: true,
  });
  const response = await google.GoogleSignin.signIn();
  if (response.type === 'cancelled') return null;
  const token = response.data.idToken;
  if (!token)
    throw Object.assign(new Error('Google did not return an ID token'), {
      code: 'auth/invalid-credential',
    });
  return signInWithCredential(auth, GoogleAuthProvider.credential(token));
}
