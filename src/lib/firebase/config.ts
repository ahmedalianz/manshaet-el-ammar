import {
  type FirebaseOptions,
  initializeApp,
  getApp,
  getApps,
} from '@firebase/app';

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
// Email/password Auth and Firestore do not require the OAuth redirect domain.
export const isFirebaseConfigured = [
  firebaseConfig.apiKey,
  firebaseConfig.projectId,
  firebaseConfig.appId,
].every((value) => Boolean(value) && !value?.startsWith('your-'));
export const firebaseConfigurationMessage =
  'لسه بنجهّز الحسابات والطلبات. تقدر تتصفح التطبيق، وتسجيل الدخول وحفظ الطلبات هيشتغلوا بعد ما نكمّل الإعدادات.';
function createApp() {
  if (!isFirebaseConfigured) return null;
  try {
    return getApps().some((app) => app.name === '[DEFAULT]')
      ? getApp()
      : initializeApp(firebaseConfig);
  } catch {
    if (__DEV__)
      console.warn(
        '[Firebase] App initialization failed. Check the Firebase client configuration.',
      );
    return null;
  }
}
export const firebaseApp = createApp();
if (!firebaseApp && __DEV__)
  console.info(
    '[Firebase] Client configuration unavailable. See .env.example and docs/firebase-setup.md.',
  );
export const useFirebaseEmulators =
  __DEV__ && process.env.EXPO_PUBLIC_FIREBASE_USE_EMULATORS === 'true';
export const firebaseEmulatorHost =
  process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || 'localhost';
