import { connectAuthEmulator, getAuth, type Auth } from '@firebase/auth';
import {
  firebaseApp,
  firebaseEmulatorHost,
  useFirebaseEmulators,
} from './config';
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
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
