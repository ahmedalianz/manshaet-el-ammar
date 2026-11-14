import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from '@firebase/firestore';
import {
  firebaseApp,
  firebaseEmulatorHost,
  useFirebaseEmulators,
} from './config';
const registry = globalThis as typeof globalThis & {
  __manshaetFirestoreEmulators?: WeakSet<Firestore>;
};
const connected = (registry.__manshaetFirestoreEmulators ??=
  new WeakSet<Firestore>());
export const db = firebaseApp ? getFirestore(firebaseApp) : null;
if (db && useFirebaseEmulators && !connected.has(db)) {
  connectFirestoreEmulator(
    db,
    firebaseEmulatorHost,
    Number(process.env.EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT || 8080),
  );
  connected.add(db);
}
