import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';
import type { Persistence } from '@firebase/auth';

// The Firebase React Native entrypoint exports this helper, but its shared type
// declarations omit it.
declare module '@firebase/auth' {
  export function getReactNativePersistence(
    storage: Pick<AsyncStorageStatic, 'getItem' | 'setItem' | 'removeItem'>,
  ): Persistence;
}
