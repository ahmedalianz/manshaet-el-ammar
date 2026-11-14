import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  terminate,
} from 'firebase/firestore';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFile } from 'node:fs/promises';

const projectId = 'demo-manshaet';
if (
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' ||
  process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080'
) {
  throw new Error(
    'Auth integration tests require the local demo-manshaet Auth and Firestore emulators.',
  );
}
let app;
let auth;
let db;
let rulesEnvironment;
let uid;
const email = 'provider-integration@example.test';
const password = 'LocalEmulator-Only-123!';

before(async () => {
  const response = await fetch(
    `http://127.0.0.1:9099/emulator/v1/projects/${projectId}/accounts`,
    { method: 'DELETE' },
  );
  assert.equal(response.ok, true);
  rulesEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: await readFile(
        new URL('../firestore.rules', import.meta.url),
        'utf8',
      ),
    },
  });
  await rulesEnvironment.clearFirestore();
  app = initializeApp(
    {
      apiKey: 'demo-emulator-key',
      projectId,
      authDomain: `${projectId}.firebaseapp.com`,
    },
    'rules-auth-integration',
  );
  auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
});
after(async () => {
  if (db) await terminate(db);
  if (app) await deleteApp(app);
  await rulesEnvironment?.cleanup();
});

describe('real Auth emulator and Firestore SDK round trip', () => {
  it('registers an email/password user and saves only their allowed profile fields', async () => {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    uid = credential.user.uid;
    await setDoc(doc(db, 'users', uid), {
      displayName: 'حساب تجريبي محلي',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const profile = await getDoc(doc(db, 'users', uid));
    assert.equal(profile.data().displayName, 'حساب تجريبي محلي');
    assert.equal(
      (await credential.user.getIdTokenResult()).claims.admin,
      undefined,
    );
    await assert.rejects(
      setDoc(doc(db, 'providers', 'direct-auth-injection'), { ownerId: uid }),
      { code: 'permission-denied' },
    );
  });
  it('signs out then signs in to the same account and reads its server profile', async () => {
    await signOut(auth);
    assert.equal(auth.currentUser, null);
    await assert.rejects(getDoc(doc(db, 'users', uid)), {
      code: 'permission-denied',
    });
    const credential = await signInWithEmailAndPassword(auth, email, password);
    assert.equal(credential.user.uid, uid);
    assert.equal(
      (await getDoc(doc(db, 'users', uid))).data().displayName,
      'حساب تجريبي محلي',
    );
  });
  it('uses the Auth reset-password API without sending real email', async () => {
    await sendPasswordResetEmail(auth, email);
    const response = await fetch(
      `http://127.0.0.1:9099/emulator/v1/projects/${projectId}/oobCodes`,
    );
    assert.equal(response.ok, true);
    const payload = await response.json();
    assert.equal(
      payload.oobCodes.some(
        (code) => code.email === email && code.requestType === 'PASSWORD_RESET',
      ),
      true,
    );
  });
});
