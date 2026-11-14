import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  connectAuthEmulator,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from '@firebase/auth';

import {
  firebaseApp,
  firebaseEmulatorHost,
  useFirebaseEmulators,
} from './config';

function createAuth(): Auth | null {
  if (!firebaseApp) {
    return null;
  }

  try {
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'auth/already-initialized'
    ) {
      return getAuth(firebaseApp);
    }

    throw error;
  }
}

export const auth = createAuth();

const registry = globalThis as typeof globalThis & {
  __manshaetAuthEmulators?: WeakSet<Auth>;
};
const connected = (registry.__manshaetAuthEmulators ??= new WeakSet<Auth>());
if (auth && useFirebaseEmulators && !connected.has(auth)) {
  connectAuthEmulator(
    auth,
    `http://${firebaseEmulatorHost}:${process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT || 9099}`,
  );
  connected.add(auth);
}
