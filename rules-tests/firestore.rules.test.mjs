import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

const projectId = 'demo-manshaet';
const expectedHost = '127.0.0.1:8080';
if (process.env.FIRESTORE_EMULATOR_HOST !== expectedHost) {
  throw new Error(
    `Run npm run test:rules: only ${expectedHost} on ${projectId} is permitted.`,
  );
}
let environment;
const yesterday = Timestamp.fromDate(new Date('2026-11-03T10:00:00.000Z'));
const values = (extra = {}) => ({
  displayName: 'مزود تجريبي',
  categoryId: 'plumbing',
  serviceTitle: 'سباك صحي',
  serviceMode: 'fixed',
  description: 'وصف تجريبي',
  phone: '01012345678',
  address: 'شارع المدرسة، بجوار المسجد',
  ...extra,
});
const requestData = (extra = {}) => ({
  ownerId: 'owner',
  providerId: 'new-service',
  type: 'create',
  status: 'pending',
  proposedData: values(),
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  consent: true,
  consentedAt: serverTimestamp(),
  ...extra,
});
const historicalRequest = (extra = {}) => ({
  ...requestData(),
  createdAt: yesterday,
  updatedAt: yesterday,
  consentedAt: yesterday,
  ...extra,
});
const slotData = (
  requestId,
  providerId = 'new-service',
  ownerId = 'owner',
) => ({
  ownerId,
  providerId,
  requestId,
  updatedAt: serverTimestamp(),
});
const ownerDb = () => environment.authenticatedContext('owner').firestore();
const strangerDb = () =>
  environment.authenticatedContext('stranger').firestore();
const adminDb = () =>
  environment.authenticatedContext('admin-user', { admin: true }).firestore();
const guestDb = () => environment.unauthenticatedContext().firestore();
const writeSubmission = async (
  db,
  id = 'request-new',
  extra = {},
  slotExtra = {},
  receiptChunks = ['0', '1', '2', '3'],
) => {
  const data = requestData(extra);
  const batch = writeBatch(db);
  batch.set(doc(db, 'serviceRequests', id), data);
  if (data.proposedData.weeklyHours)
    for (const chunk of receiptChunks)
      batch.set(doc(db, 'serviceRequests', id, 'scheduleValidation', chunk), {
        ownerId: data.ownerId,
        createdAt: serverTimestamp(),
      });
  batch.set(doc(db, 'requestSlots', data.providerId), {
    ...slotData(id, data.providerId, data.ownerId),
    ...(data.proposedData.weeklyHours
      ? { weeklyHours: data.proposedData.weeklyHours }
      : {}),
    ...slotExtra,
  });
  return batch.commit();
};
async function seed(records) {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const batch = writeBatch(db);
    for (const [path, data] of Object.entries(records))
      batch.set(doc(db, path), data);
    await batch.commit();
  });
}

before(async () => {
  environment = await initializeTestEnvironment({
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
});
after(async () => {
  await environment?.cleanup();
});
beforeEach(async () => {
  await environment.clearFirestore();
  await seed({
    'categories/plumbing': {
      name: 'سباكة',
      description: 'أعمال منزلية',
      icon: 'pipe-wrench',
      order: 1,
      active: true,
    },
    'categories/inactive': {
      name: 'قسم مغلق',
      description: '',
      icon: 'briefcase',
      order: 2,
      active: false,
    },
    'users/owner': {
      displayName: 'حساب تجريبي',
      createdAt: yesterday,
      updatedAt: yesterday,
    },
    'providers/owned-service': {
      ...values(),
      ownerId: 'owner',
      publishedAt: yesterday,
      updatedAt: yesterday,
    },
    'providers/other-service': {
      ...values(),
      ownerId: 'stranger',
      publishedAt: yesterday,
      updatedAt: yesterday,
    },
    'serviceRequests/owned-pending': historicalRequest({
      providerId: 'pending-service',
    }),
    'serviceRequests/other-pending': historicalRequest({
      providerId: 'other-pending-service',
      ownerId: 'stranger',
    }),
    'requestSlots/pending-service': {
      ...slotData('owned-pending', 'pending-service'),
      updatedAt: yesterday,
    },
    'reports/private-report': {
      providerId: 'owned-service',
      reporterId: 'owner',
      reason: 'بلاغ تجريبي',
      createdAt: yesterday,
    },
  });
});

describe('public discovery and private owner data', () => {
  it('allows guests to read published provider documents and lists', async () => {
    await assertSucceeds(getDoc(doc(guestDb(), 'providers/owned-service')));
    await assertSucceeds(getDocs(collection(guestDb(), 'providers')));
  });
  it('allows only active public categories and correctly constrained category queries', async () => {
    await assertSucceeds(getDoc(doc(guestDb(), 'categories/plumbing')));
    await assertFails(getDoc(doc(guestDb(), 'categories/inactive')));
    await assertSucceeds(
      getDocs(
        query(collection(guestDb(), 'categories'), where('active', '==', true)),
      ),
    );
    await assertFails(getDocs(collection(guestDb(), 'categories')));
    await assertSucceeds(getDocs(collection(adminDb(), 'categories')));
  });
  it('blocks guests from requests, slots, reports, profiles and all writes', async () => {
    for (const path of [
      'serviceRequests/owned-pending',
      'requestSlots/pending-service',
      'reports/private-report',
      'users/owner',
    ])
      await assertFails(getDoc(doc(guestDb(), path)));
    await assertFails(writeSubmission(guestDb()));
    await assertFails(setDoc(doc(guestDb(), 'providers/injected'), values()));
  });
  it('lets owners read only their own request history and constrained lists', async () => {
    await assertSucceeds(
      getDoc(doc(ownerDb(), 'serviceRequests/owned-pending')),
    );
    await assertFails(getDoc(doc(ownerDb(), 'serviceRequests/other-pending')));
    await assertSucceeds(
      getDocs(
        query(
          collection(ownerDb(), 'serviceRequests'),
          where('ownerId', '==', 'owner'),
        ),
      ),
    );
    await assertFails(getDocs(collection(ownerDb(), 'serviceRequests')));
    await assertSucceeds(getDocs(collection(adminDb(), 'serviceRequests')));
  });
  it('allows owners to read an absent slot for first-submission transactions, never another owner slot', async () => {
    const missing = await assertSucceeds(
      getDoc(doc(ownerDb(), 'requestSlots/new-service')),
    );
    assert.equal(missing.exists(), false);
    await assertSucceeds(
      getDoc(doc(ownerDb(), 'requestSlots/pending-service')),
    );
    await assertFails(
      getDoc(doc(strangerDb(), 'requestSlots/pending-service')),
    );
  });
  it('allows authenticated missing-request preflight reads but never guests or foreign existing requests', async () => {
    const missing = await assertSucceeds(
      getDoc(doc(ownerDb(), 'serviceRequests/not-submitted-yet')),
    );
    assert.equal(missing.exists(), false);
    await assertFails(
      getDoc(doc(guestDb(), 'serviceRequests/not-submitted-yet')),
    );
    await assertFails(
      getDoc(doc(strangerDb(), 'serviceRequests/owned-pending')),
    );
  });
  it('authorizes the exact bounded repository queries for categories, public providers and owner history', async () => {
    await assertSucceeds(
      getDocs(
        query(
          collection(guestDb(), 'categories'),
          where('active', '==', true),
          orderBy('order'),
          limit(100),
        ),
      ),
    );
    await assertSucceeds(
      getDocs(
        query(
          collection(guestDb(), 'providers'),
          orderBy('publishedAt', 'desc'),
          limit(100),
        ),
      ),
    );
    await assertSucceeds(
      getDocs(
        query(
          collection(guestDb(), 'providers'),
          where('categoryId', '==', 'plumbing'),
          orderBy('publishedAt', 'desc'),
          limit(50),
        ),
      ),
    );
    await assertSucceeds(
      getDocs(
        query(
          collection(ownerDb(), 'providers'),
          where('ownerId', '==', 'owner'),
          orderBy('updatedAt', 'desc'),
          limit(100),
        ),
      ),
    );
    await assertSucceeds(
      getDocs(
        query(
          collection(ownerDb(), 'serviceRequests'),
          where('ownerId', '==', 'owner'),
          orderBy('createdAt', 'desc'),
          limit(100),
        ),
      ),
    );
  });
  it('keeps reports private from reporters and owners while allowing admins', async () => {
    await assertFails(getDoc(doc(ownerDb(), 'reports/private-report')));
    await assertFails(getDocs(collection(ownerDb(), 'reports')));
    await assertSucceeds(getDocs(collection(adminDb(), 'reports')));
  });
});

describe('profiles and custom admin claims', () => {
  it('allows an owner to create and update their profile using server timestamps', async () => {
    const db = strangerDb();
    await assertSucceeds(
      setDoc(doc(db, 'users/stranger'), {
        displayName: 'اسم جديد',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(db, 'users/stranger'), {
        displayName: 'اسم معدل',
        updatedAt: serverTimestamp(),
      }),
    );
  });
  it('rejects role injection, empty or oversized names, timestamp changes, foreign edits and deletes', async () => {
    const db = ownerDb();
    for (const patch of [
      { role: 'admin' },
      { admin: true },
      { displayName: '' },
      { displayName: '   ' },
      { displayName: 'x'.repeat(101) },
      { createdAt: serverTimestamp() },
      { updatedAt: yesterday },
    ]) {
      await assertFails(
        updateDoc(doc(db, 'users/owner'), {
          ...patch,
          ...(Object.hasOwn(patch, 'updatedAt')
            ? {}
            : { updatedAt: serverTimestamp() }),
        }),
      );
    }
    await assertFails(
      updateDoc(doc(strangerDb(), 'users/owner'), {
        displayName: 'دخيل',
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(deleteDoc(doc(db, 'users/owner')));
  });
  it('rejects self-appointed admin fields, false/string claims and admin-looking UIDs', async () => {
    for (const context of [
      environment.authenticatedContext('admin'),
      environment.authenticatedContext('owner', { admin: false }),
      environment.authenticatedContext('owner', { admin: 'true' }),
    ]) {
      await assertFails(
        setDoc(doc(context.firestore(), 'providers/forged-service'), values()),
      );
      await assertFails(
        updateDoc(doc(context.firestore(), 'serviceRequests/owned-pending'), {
          status: 'approved',
        }),
      );
    }
    await seed({
      'users/owner': {
        displayName: 'مالك',
        createdAt: yesterday,
        updatedAt: yesterday,
        admin: true,
      },
    });
    await assertFails(
      setDoc(doc(ownerDb(), 'categories/forged'), { active: true }),
    );
  });
  it('allows custom-claim admins to review requests, publish/unpublish providers and maintain categories', async () => {
    const db = adminDb();
    await assertSucceeds(
      updateDoc(doc(db, 'serviceRequests/owned-pending'), {
        status: 'approved',
        reviewedBy: 'admin-user',
        reviewedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      setDoc(doc(db, 'providers/pending-service'), {
        ...values(),
        ownerId: 'owner',
        publishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(deleteDoc(doc(db, 'providers/pending-service')));
    await assertSucceeds(
      updateDoc(doc(db, 'categories/plumbing'), { active: false }),
    );
  });
});

describe('admin permanent service removal', () => {
  it('denies deletion of submissions and slots to guests, owners and other users', async () => {
    for (const db of [guestDb(), ownerDb(), strangerDb()]) {
      await assertFails(deleteDoc(doc(db, 'serviceRequests/owned-pending')));
      await assertFails(deleteDoc(doc(db, 'requestSlots/pending-service')));
      await assertFails(deleteDoc(doc(db, 'providers/owned-service')));
    }
  });
  it('allows an admin to atomically remove the service, slot, and submissions', async () => {
    const db = adminDb();
    await assertSucceeds(
      runTransaction(db, async (transaction) => {
        transaction.delete(doc(db, 'providers/pending-service'));
        transaction.delete(doc(db, 'requestSlots/pending-service'));
        transaction.delete(doc(db, 'serviceRequests/owned-pending'));
      }),
    );
    assert.equal(
      (await getDoc(doc(db, 'serviceRequests/owned-pending'))).exists(),
      false,
    );
    assert.equal(
      (await getDoc(doc(db, 'requestSlots/pending-service'))).exists(),
      false,
    );
  });
  it('allows admin unpublishing while preserving submissions', async () => {
    const db = adminDb();
    await assertSucceeds(deleteDoc(doc(db, 'providers/owned-service')));
    assert.equal(
      (await getDoc(doc(db, 'serviceRequests/owned-pending'))).exists(),
      true,
    );
  });
});

describe('immutable submissions and atomic request slots', () => {
  it('accepts a valid new request only with an atomic matching slot', async () => {
    await assertSucceeds(writeSubmission(ownerDb()));
    const request = await getDoc(doc(ownerDb(), 'serviceRequests/request-new'));
    assert.equal(request.data().status, 'pending');
    assert.equal(request.data().consent, true);
    await assertFails(getDoc(doc(guestDb(), 'serviceRequests/request-new')));
    const published = await getDocs(collection(guestDb(), 'providers'));
    assert.equal(published.size, 2);
  });
  it('rejects a standalone request or standalone slot and mismatched request/slot owners and IDs', async () => {
    await assertFails(
      setDoc(doc(ownerDb(), 'serviceRequests/request-alone'), requestData()),
    );
    await assertFails(
      setDoc(
        doc(ownerDb(), 'requestSlots/new-service'),
        slotData('request-alone'),
      ),
    );
    await assertFails(
      writeSubmission(
        ownerDb(),
        'request-wrong-slot',
        {},
        { requestId: 'different' },
      ),
    );
    await assertFails(
      writeSubmission(
        ownerDb(),
        'request-wrong-owner',
        {},
        { ownerId: 'stranger' },
      ),
    );
  });
  it('requires consent, complete fields and server-controlled timestamps', async () => {
    const missingConsent = requestData();
    delete missingConsent.consent;
    const db = ownerDb();
    const batch = writeBatch(db);
    batch.set(doc(db, 'serviceRequests/missing-consent'), missingConsent);
    batch.set(doc(db, 'requestSlots/new-service'), slotData('missing-consent'));
    await assertFails(batch.commit());
    for (const extra of [
      { consent: false },
      { consent: 'true' },
      { consentedAt: yesterday },
      { createdAt: yesterday },
      { updatedAt: yesterday },
    ])
      await assertFails(writeSubmission(db, 'bad-consent-time', extra));
  });
  it('blocks self-approval and extra review fields on creation', async () => {
    for (const extra of [
      { status: 'approved' },
      { status: 'rejected' },
      { reviewedBy: 'owner' },
      { reviewedAt: serverTimestamp() },
      { rejectionReason: 'سبب' },
      { surprise: true },
    ])
      await assertFails(writeSubmission(ownerDb(), 'bad-fields', extra));
  });
  it('rejects forged owners, direct provider/category writes and edits to submitted requests', async () => {
    await assertFails(
      writeSubmission(ownerDb(), 'forged-owner', { ownerId: 'stranger' }),
    );
    await assertFails(
      setDoc(doc(ownerDb(), 'providers/direct'), {
        ...values(),
        ownerId: 'owner',
      }),
    );
    await assertFails(
      updateDoc(doc(ownerDb(), 'providers/owned-service'), {
        phone: '01112345678',
      }),
    );
    await assertFails(
      setDoc(doc(ownerDb(), 'categories/direct'), { active: true }),
    );
    await assertFails(
      updateDoc(doc(ownerDb(), 'serviceRequests/owned-pending'), {
        status: 'approved',
      }),
    );
    await assertFails(
      updateDoc(doc(ownerDb(), 'serviceRequests/owned-pending'), {
        'proposedData.phone': '01112345678',
      }),
    );
    await assertFails(
      deleteDoc(doc(ownerDb(), 'serviceRequests/owned-pending')),
    );
  });
  it('accepts an update only for a currently published provider belonging to the owner', async () => {
    await assertSucceeds(
      writeSubmission(ownerDb(), 'owned-update', {
        type: 'update',
        providerId: 'owned-service',
      }),
    );
    await assertFails(
      writeSubmission(ownerDb(), 'foreign-update', {
        type: 'update',
        providerId: 'other-service',
      }),
    );
    await assertFails(
      writeSubmission(ownerDb(), 'missing-update', {
        type: 'update',
        providerId: 'missing-service',
      }),
    );
  });
  it('does not allow create requests to overwrite an existing published service', async () => {
    await assertFails(
      writeSubmission(ownerDb(), 'overwrite', {
        type: 'create',
        providerId: 'owned-service',
      }),
    );
  });
  it('blocks a second pending request and owner pending-slot replacement or deletion', async () => {
    await assertFails(
      writeSubmission(ownerDb(), 'second-pending', {
        providerId: 'pending-service',
      }),
    );
    await assertFails(
      deleteDoc(doc(ownerDb(), 'requestSlots/pending-service')),
    );
    await assertFails(
      updateDoc(doc(ownerDb(), 'requestSlots/pending-service'), {
        ownerId: 'stranger',
      }),
    );
  });
  it('allows rejected-create resubmission under the same stable provider ID while retaining history', async () => {
    await assertSucceeds(
      updateDoc(doc(adminDb(), 'serviceRequests/owned-pending'), {
        status: 'rejected',
        rejectionReason: 'وضح العنوان',
        reviewedBy: 'admin-user',
        reviewedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      writeSubmission(ownerDb(), 'resubmitted-create', {
        providerId: 'pending-service',
      }),
    );
    const before = await getDoc(
      doc(ownerDb(), 'serviceRequests/owned-pending'),
    );
    assert.equal(before.data().status, 'rejected');
    const slot = await getDoc(doc(ownerDb(), 'requestSlots/pending-service'));
    assert.equal(slot.data().requestId, 'resubmitted-create');
  });
  it('allows subsequent updates after review without replacing old requests', async () => {
    await assertSucceeds(
      writeSubmission(ownerDb(), 'update-one', {
        type: 'update',
        providerId: 'owned-service',
      }),
    );
    await assertSucceeds(
      updateDoc(doc(adminDb(), 'serviceRequests/update-one'), {
        status: 'approved',
        reviewedBy: 'admin-user',
        reviewedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      writeSubmission(ownerDb(), 'update-two', {
        type: 'update',
        providerId: 'owned-service',
      }),
    );
    assert.equal(
      (await getDoc(doc(ownerDb(), 'serviceRequests/update-one'))).data()
        .status,
      'approved',
    );
  });
  it('blocks create-after-unpublish when historical create was approved or last request was an update', async () => {
    await seed({
      'serviceRequests/approved-history': historicalRequest({
        providerId: 'removed-create',
        status: 'approved',
      }),
      'requestSlots/removed-create': {
        ...slotData('approved-history', 'removed-create'),
        updatedAt: yesterday,
      },
      'serviceRequests/rejected-update-history': historicalRequest({
        providerId: 'removed-update',
        type: 'update',
        status: 'rejected',
      }),
      'requestSlots/removed-update': {
        ...slotData('rejected-update-history', 'removed-update'),
        updatedAt: yesterday,
      },
    });
    await assertFails(
      writeSubmission(ownerDb(), 'recreate-approved', {
        providerId: 'removed-create',
      }),
    );
    await assertFails(
      writeSubmission(ownerDb(), 'recreate-update', {
        providerId: 'removed-update',
      }),
    );
  });
  it('prevents retargeting a slot to an existing request and cross-owner stable ID reuse', async () => {
    await assertSucceeds(
      updateDoc(doc(adminDb(), 'serviceRequests/owned-pending'), {
        status: 'rejected',
      }),
    );
    await assertFails(
      writeSubmission(strangerDb(), 'steal-slot', {
        providerId: 'pending-service',
        ownerId: 'stranger',
      }),
    );
    await seed({
      'serviceRequests/existing-request': historicalRequest({
        providerId: 'pending-service',
      }),
    });
    await assertFails(
      setDoc(
        doc(ownerDb(), 'requestSlots/pending-service'),
        slotData('existing-request', 'pending-service'),
      ),
    );
  });
  it('rejects stale concurrent transactions so only one pending slot wins', async () => {
    const db = ownerDb();
    const attempts = ['race-one', 'race-two'].map((id) =>
      runTransaction(db, async (transaction) => {
        const slot = await transaction.get(
          doc(db, 'requestSlots/race-service'),
        );
        if (slot.exists())
          throw new Error('A pending request already occupies the slot.');
        transaction.set(
          doc(db, 'serviceRequests', id),
          requestData({ providerId: 'race-service' }),
        );
        transaction.set(
          doc(db, 'requestSlots/race-service'),
          slotData(id, 'race-service'),
        );
      }),
    );
    const results = await Promise.allSettled(attempts);
    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      results.filter((result) => result.status === 'rejected').length,
      1,
    );
    const history = await getDocs(
      query(
        collection(db, 'serviceRequests'),
        where('ownerId', '==', 'owner'),
        where('providerId', '==', 'race-service'),
      ),
    );
    assert.equal(history.size, 1);
  });
});

describe('service validation and authenticated reporting', () => {
  it('validates canonical phone and optional WhatsApp numbers', async () => {
    for (const phone of ['01112345678', '01212345678', '01512345678'])
      await assertSucceeds(
        writeSubmission(ownerDb(), `valid-${phone}`, {
          providerId: `provider-${phone}`,
          proposedData: values({ phone, whatsapp: phone }),
        }),
      );
    for (const phone of [
      '123',
      '+201012345678',
      '01312345678',
      '٠١٠١٢٣٤٥٦٧٨',
      '010 1234 5678',
    ])
      await assertFails(
        writeSubmission(ownerDb(), 'bad-phone', {
          proposedData: values({ phone }),
        }),
      );
    await assertFails(
      writeSubmission(ownerDb(), 'bad-whatsapp', {
        proposedData: values({ whatsapp: '123' }),
      }),
    );
  });
  it('requires an active category and rejects obsolete area fields', async () => {
    for (const patch of [
      { categoryId: 'inactive' },
      { categoryId: 'unknown' },
      { areaId: 'وسط البلد' },
      { areaId: 'unknown' },
    ])
      await assertFails(
        writeSubmission(ownerDb(), 'bad-category-area', {
          proposedData: values(patch),
        }),
      );
  });
  it('checks string bounds, required fields and unknown proposed-data keys', async () => {
    for (const patch of [
      { displayName: '' },
      { displayName: 'x'.repeat(101) },
      { serviceTitle: 'x'.repeat(161) },
      { description: 'x'.repeat(2001) },
      { address: 'x'.repeat(501) },
      { address: '' },
      { displayName: 42 },
      { ownerId: 'owner' },
      { status: 'approved' },
    ])
      await assertFails(
        writeSubmission(ownerDb(), 'invalid-values', {
          proposedData: values(patch),
        }),
      );
    const missingTitle = values();
    delete missingTitle.serviceTitle;
    await assertFails(
      writeSubmission(ownerDb(), 'missing-title', {
        proposedData: missingTitle,
      }),
    );
  });
  it('accepts valid optional coordinates and rejects invalid or unexpected coordinate fields', async () => {
    await assertSucceeds(
      writeSubmission(ownerDb(), 'located', {
        proposedData: values({
          location: { latitude: 30.35, longitude: 31.2 },
        }),
      }),
    );
    for (const location of [
      null,
      { latitude: 91, longitude: 31 },
      { latitude: 30, longitude: -181 },
      { latitude: '30', longitude: 31 },
      { latitude: 30, longitude: 31, accuracy: 3 },
    ])
      await assertFails(
        writeSubmission(ownerDb(), 'bad-location', {
          proposedData: values({ location }),
        }),
      );
  });
  it('accepts authenticated reports with own identity and a server timestamp', async () => {
    await assertSucceeds(
      setDoc(doc(ownerDb(), 'reports/report-new'), {
        providerId: 'owned-service',
        reason: 'رقم لا يعمل',
        reporterId: 'owner',
        createdAt: serverTimestamp(),
      }),
    );
    await assertFails(getDoc(doc(ownerDb(), 'reports/report-new')));
    await assertSucceeds(getDoc(doc(adminDb(), 'reports/report-new')));
    await assertSucceeds(
      updateDoc(doc(adminDb(), 'reports/report-new'), { status: 'closed' }),
    );
  });
  it('rejects forged, empty, oversized or timestamp-spoofed reports and owner review/delete', async () => {
    const valid = {
      providerId: 'owned-service',
      reason: 'رقم لا يعمل',
      reporterId: 'owner',
      createdAt: serverTimestamp(),
    };
    for (const patch of [
      { reporterId: 'stranger' },
      { reason: '' },
      { reason: ' ' },
      { reason: 'x'.repeat(1001) },
      { createdAt: yesterday },
      { status: 'closed' },
    ])
      await assertFails(
        setDoc(doc(ownerDb(), 'reports/report-bad'), { ...valid, ...patch }),
      );
    await assertFails(setDoc(doc(guestDb(), 'reports/guest-report'), valid));
    await assertFails(
      updateDoc(doc(ownerDb(), 'reports/private-report'), { status: 'closed' }),
    );
    await assertFails(deleteDoc(doc(ownerDb(), 'reports/private-report')));
  });
  it('denies unknown collections and subcollections by default', async () => {
    await assertFails(setDoc(doc(ownerDb(), 'roles/owner'), { admin: true }));
    await assertFails(getDoc(doc(adminDb(), 'unknown/example')));
    await assertFails(
      setDoc(doc(adminDb(), 'providers/owned-service/private/example'), {
        secret: true,
      }),
    );
  });
});

describe('unlimited provider submissions', () => {
  it('allows an owner to submit more than 3 new services', async () => {
    for (let i = 1; i <= 4; i++)
      await assertSucceeds(
        writeSubmission(strangerDb(), `unlimited-${i}`, {
          ownerId: 'stranger',
          providerId: `unlimited-${i}`,
        }),
      );
  });
});

describe('private unpublished recovery archive', () => {
  const archived = () => ({
    ...values(),
    weeklyHours: Object.fromEntries(
      ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'].map((day) => [
        day,
        '4,540,720,840,1080',
      ]),
    ),
    ownerId: 'owner',
    publishedAt: yesterday,
    archiveStatus: 'unpublished',
    unpublishReason: 'راجع عنوان الخدمة',
    unpublishedAt: yesterday,
    unpublishedBy: 'admin-user',
  });
  it('keeps the archive out of guest and foreign-owner reads and owner writes', async () => {
    await seed({ 'archivedProviders/hidden': archived() });
    const owner = environment.authenticatedContext('owner').firestore();
    const other = environment.authenticatedContext('other').firestore();
    const guest = environment.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(owner, 'archivedProviders', 'hidden')));
    await assertSucceeds(
      getDocs(
        query(
          collection(owner, 'archivedProviders'),
          where('ownerId', '==', 'owner'),
          where('archiveStatus', '==', 'unpublished'),
          orderBy('unpublishedAt', 'desc'),
          limit(100),
        ),
      ),
    );
    await assertFails(getDoc(doc(other, 'archivedProviders', 'hidden')));
    await assertFails(getDoc(doc(guest, 'archivedProviders', 'hidden')));
    await assertFails(
      updateDoc(doc(owner, 'archivedProviders', 'hidden'), {
        archiveStatus: 'restored',
      }),
    );
  });
  it('requires a nonblank reason and atomic removal of the public document', async () => {
    await seed({
      'providers/hidden': {
        ...values(),
        weeklyHours: archived().weeklyHours,
        ownerId: 'owner',
        publishedAt: yesterday,
        updatedAt: yesterday,
      },
    });
    const admin = environment
      .authenticatedContext('admin-user', { admin: true })
      .firestore();
    const attempt = (reason, removePublic) => {
      const batch = writeBatch(admin);
      batch.set(doc(admin, 'archivedProviders', 'hidden'), {
        ...archived(),
        unpublishReason: reason,
        unpublishedAt: serverTimestamp(),
      });
      if (removePublic) batch.delete(doc(admin, 'providers', 'hidden'));
      return batch.commit();
    };
    await assertFails(attempt('   ', true));
    await assertFails(attempt('راجع العنوان', false));
    await assertSucceeds(attempt('راجع العنوان', true));
  });
  it('allows owner corrections only as pending restore requests with consent', async () => {
    await seed({
      'archivedProviders/hidden': archived(),
      'categories/plumbing': { active: true },
    });
    const owner = environment.authenticatedContext('owner').firestore();
    const data = requestData({ providerId: 'hidden', type: 'restore' });
    const submit = async (extra = {}) => {
      const batch = writeBatch(owner);
      batch.set(doc(owner, 'serviceRequests', 'correction'), {
        ...data,
        ...extra,
      });
      batch.set(
        doc(owner, 'requestSlots', 'hidden'),
        slotData('correction', 'hidden'),
      );
      return batch.commit();
    };
    await assertFails(submit({ consent: false }));
    await assertFails(submit({ ownerId: 'other' }));
    await assertFails(submit({ type: 'create' }));
    await assertSucceeds(submit());
    const guest = environment.unauthenticatedContext().firestore();
    const publication = await assertSucceeds(
      getDoc(doc(guest, 'providers', 'hidden')),
    );
    assert.equal(publication.exists(), false);
  });
});

describe('availability, confirmation and private support', () => {
  it('allows travelling services without coverage or a home address, and requires an explicit mode', async () => {
    const owner = ownerDb();
    const legacy = values();
    delete legacy.serviceMode;
    await assertFails(
      writeSubmission(owner, 'no-mode', { proposedData: legacy }),
    );
    await assertSucceeds(
      writeSubmission(owner, 'mobile-request', {
        proposedData: values({ serviceMode: 'mobile', address: '' }),
      }),
    );
  });
  it('rejects retired coverage fields in new submissions', async () => {
    await assertFails(
      writeSubmission(ownerDb(), 'retired-coverage', {
        proposedData: values({ coverageAreas: ['all'] }),
      }),
    );
  });
  it('accepts a full two-period week, but rejects overlapping and malformed hours', async () => {
    const week = Object.fromEntries(
      ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'].map((day) => [
        day,
        '4,540,720,840,1080',
      ]),
    );
    await assertSucceeds(
      writeSubmission(ownerDb(), 'hours', {
        proposedData: values({ serviceMode: 'fixed', weeklyHours: week }),
      }),
    );
    await assertSucceeds(
      writeSubmission(ownerDb(), 'overnight-full', {
        providerId: 'overnight-full',
        proposedData: values({
          serviceMode: 'both',
          whatsapp: '01112345678',
          location: { latitude: 30, longitude: 31 },
          weeklyHours: Object.fromEntries(
            Object.keys(week).map((day) => [day, '4,540,720,1320,1560']),
          ),
        }),
      }),
    );
    await assertFails(
      writeSubmission(ownerDb(), 'overlap', {
        providerId: 'bad-hours',
        proposedData: values({
          serviceMode: 'fixed',
          weeklyHours: {
            ...week,
            sat: '4,1320,1620,0,0',
            sun: '4,120,360,0,0',
          },
        }),
      }),
    );
    await assertFails(
      writeSubmission(ownerDb(), 'malformed', {
        providerId: 'malformed',
        proposedData: values({
          serviceMode: 'fixed',
          weeklyHours: { ...week, sat: '4,5940,0,0,0' },
        }),
      }),
    );
  });
  it('requires every atomic schedule receipt and validates every day, including overnight updates and resubmission', async () => {
    const days = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
    const week = Object.fromEntries(
      days.map((day) => [day, '4,540,720,1320,1560']),
    );
    const owner = ownerDb();
    await seed(
      Object.fromEntries(
        ['0', '1', '2', '3'].map((chunk) => [
          `serviceRequests/stale-receipts/scheduleValidation/${chunk}`,
          { ownerId: 'owner', createdAt: yesterday },
        ]),
      ),
    );
    await assertFails(
      writeSubmission(
        owner,
        'stale-receipts',
        { proposedData: values({ weeklyHours: week }) },
        {},
        [],
      ),
    );
    await assertFails(
      setDoc(
        doc(owner, 'serviceRequests', 'preseed', 'scheduleValidation', '0'),
        { ownerId: 'owner', createdAt: serverTimestamp() },
      ),
    );
    await assertFails(
      writeSubmission(
        owner,
        'missing-receipt',
        { proposedData: values({ weeklyHours: week }) },
        {},
        ['0', '1', '2'],
      ),
    );
    await assertFails(
      writeSubmission(
        owner,
        'mirror',
        { proposedData: values({ weeklyHours: week }) },
        { weeklyHours: { ...week, sat: '1,0,0,0,0' } },
      ),
    );
    for (const day of days) {
      await assertFails(
        writeSubmission(owner, `invalid-${day}`, {
          providerId: `invalid-${day}`,
          proposedData: values({
            weeklyHours: { ...week, [day]: '4,540,500,0,0' },
          }),
        }),
      );
    }
    await assertSucceeds(
      writeSubmission(owner, 'full-create', {
        providerId: 'full-create',
        proposedData: values({ weeklyHours: week }),
      }),
    );
    await assertFails(
      updateDoc(
        doc(owner, 'serviceRequests', 'full-create', 'scheduleValidation', '0'),
        { createdAt: serverTimestamp() },
      ),
    );
    await assertFails(
      deleteDoc(
        doc(owner, 'serviceRequests', 'full-create', 'scheduleValidation', '0'),
      ),
    );
    await assertSucceeds(
      updateDoc(doc(adminDb(), 'serviceRequests', 'full-create'), {
        status: 'rejected',
      }),
    );
    await assertSucceeds(
      writeSubmission(owner, 'full-resubmit', {
        providerId: 'full-create',
        proposedData: values({ weeklyHours: week }),
      }),
    );
    await assertSucceeds(
      writeSubmission(owner, 'full-update', {
        providerId: 'owned-service',
        type: 'update',
        proposedData: values({ weeklyHours: week }),
      }),
    );
  });
  it('allows only owners to stamp the confirmation date and forbids edits piggybacking on it', async () => {
    const ref = doc(ownerDb(), 'providers', 'owned-service');
    await assertSucceeds(
      updateDoc(ref, { lastConfirmedAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(ref, {
        phone: '01112345678',
        lastConfirmedAt: serverTimestamp(),
      }),
    );
    await assertFails(updateDoc(ref, { lastConfirmedAt: yesterday }));
    await assertFails(
      updateDoc(doc(strangerDb(), 'providers', 'owned-service'), {
        lastConfirmedAt: serverTimestamp(),
      }),
    );
  });
  it('creates private idempotency-readable tickets, denies guest/foreign reads and owner status edits', async () => {
    const data = {
      ownerId: 'owner',
      kind: 'support',
      message: 'محتاج مساعدة',
      status: 'received',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await assertFails(setDoc(doc(guestDb(), 'supportRequests', 'guest'), data));
    await assertSucceeds(
      setDoc(doc(ownerDb(), 'supportRequests', 'ticket'), data),
    );
    await assertSucceeds(getDoc(doc(ownerDb(), 'supportRequests', 'ticket')));
    await assertSucceeds(
      getDocs(
        query(
          collection(ownerDb(), 'supportRequests'),
          where('ownerId', '==', 'owner'),
          orderBy('createdAt', 'desc'),
          limit(50),
        ),
      ),
    );
    await assertFails(getDoc(doc(strangerDb(), 'supportRequests', 'ticket')));
    await assertFails(
      updateDoc(doc(ownerDb(), 'supportRequests', 'ticket'), {
        status: 'resolved',
        updatedAt: serverTimestamp(),
      }),
    );
  });
  it('rejects deletion support tickets and deletion statuses while enforcing support staff transitions with required rejection reason', async () => {
    const deletionRef = doc(ownerDb(), 'supportRequests', 'deletion');
    const deletionData = {
      ownerId: 'owner',
      kind: 'deletion',
      message: 'طلب مراجعة الحذف',
      status: 'received',
      consent: true,
      consentedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await assertFails(setDoc(deletionRef, deletionData));

    const supportRef = doc(ownerDb(), 'supportRequests', 'support-flow');
    await assertSucceeds(
      setDoc(supportRef, {
        ownerId: 'owner',
        kind: 'support',
        message: 'استفسار عن الخدمة',
        status: 'received',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    const adminRef = doc(adminDb(), 'supportRequests', 'support-flow');
    const review = (status, staffNote = '') => ({
      status,
      staffNote,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await assertFails(updateDoc(adminRef, review('resolved')));
    await assertFails(updateDoc(adminRef, review('rejected')));
    await assertFails(updateDoc(adminRef, review('awaiting_verification')));
    await assertFails(updateDoc(adminRef, review('ready_for_deletion')));
    await assertSucceeds(updateDoc(adminRef, review('in_review')));
    await assertFails(updateDoc(adminRef, review('awaiting_verification')));
    await assertSucceeds(updateDoc(adminRef, review('resolved', 'تم الحل')));
    await assertFails(updateDoc(adminRef, review('received')));
  });
});

describe('photo lifecycle server boundaries', () => {
  it('denies owners creating approved photo metadata or private candidate records', async () => {
    await assertFails(
      setDoc(doc(ownerDb(), 'servicePhotos/fake'), {
        ownerId: 'owner',
        status: 'uploaded',
      }),
    );
    await assertFails(
      updateDoc(doc(ownerDb(), 'providers/p1'), {
        placePhoto: { version: 'fake' },
      }),
    );
    await assertFails(
      setDoc(doc(ownerDb(), 'photoServiceCleanupJobs/fake'), {
        ownerId: 'owner',
        providerId: 'p1',
        reason: 'delete',
        state: 'pending',
        createdAt: serverTimestamp(),
      }),
    );
  });
  it('allows owner/admin reading private metadata but denies guests and other owners', async () => {
    await seed({
      'servicePhotos/photo1': {
        ownerId: 'owner',
        serviceId: 'p1',
        status: 'uploaded',
      },
    });
    await assertSucceeds(getDoc(doc(ownerDb(), 'servicePhotos/photo1')));
    await assertSucceeds(getDoc(doc(adminDb(), 'servicePhotos/photo1')));
    await assertFails(getDoc(doc(guestDb(), 'servicePhotos/photo1')));
    await assertFails(getDoc(doc(strangerDb(), 'servicePhotos/photo1')));
  });
});

describe('photo request ownership binding', () => {
  const candidate = (extra = {}) => ({
    ownerId: 'owner',
    serviceId: 'new-service',
    submissionId: 'photo-request',
    status: 'uploaded',
    ...extra,
  });
  const replacement = {
    photoChange: { action: 'replace', candidateId: 'candidate1' },
    photoReviewStatus: 'pending',
  };
  it('accepts an uploaded candidate bound to this owner, service and submission', async () => {
    await seed({ 'servicePhotos/candidate1': candidate() });
    await assertSucceeds(
      writeSubmission(ownerDb(), 'photo-request', replacement),
    );
  });
  it('rejects foreign owner, service, submission and incomplete uploads', async () => {
    for (const changed of [
      { ownerId: 'stranger' },
      { serviceId: 'other-service' },
      { submissionId: 'other-request' },
      { status: 'reserved' },
      { status: 'deleted' },
    ]) {
      await seed({ 'servicePhotos/candidate1': candidate(changed) });
      await assertFails(
        writeSubmission(ownerDb(), 'photo-request', replacement),
      );
    }
  });
  it('requires explicit expectedPhotoVersion on a removal request', async () => {
    const base = {
      providerId: 'owned-service',
      type: 'update',
      photoReviewStatus: 'pending',
    };
    await assertFails(
      writeSubmission(ownerDb(), 'remove-request', {
        ...base,
        photoChange: { action: 'remove' },
      }),
    );
    await assertFails(
      writeSubmission(ownerDb(), 'remove-request', {
        ...base,
        photoChange: { action: 'remove', expectedPhotoVersion: 42 },
      }),
    );
    await assertSucceeds(
      writeSubmission(ownerDb(), 'remove-request', {
        ...base,
        photoChange: { action: 'remove', expectedPhotoVersion: 'version1' },
      }),
    );
  });
});

describe('photo archive integrity', () => {
  const photo = {
    version: 'version1',
    thumbnailUrl: 'https://res.cloudinary.com/sx5exugy/image/upload/thumb.jpg',
    detailUrl: 'https://res.cloudinary.com/sx5exugy/image/upload/detail.jpg',
    width: 1280,
    height: 960,
  };
  const archive = () => ({
    ...values(),
    ownerId: 'owner',
    publishedAt: yesterday,
    archiveStatus: 'unpublished',
    unpublishReason: 'تصحيح البيانات',
    unpublishedAt: serverTimestamp(),
    unpublishedBy: 'admin-user',
    placePhoto: photo,
  });
  it('archives the exact approved photo and restores without publishing stale URLs', async () => {
    await seed({
      'providers/photo-service': {
        ...values(),
        ownerId: 'owner',
        publishedAt: yesterday,
        placePhoto: photo,
      },
    });
    const db = adminDb();
    const unpublish = (placePhoto) => {
      const batch = writeBatch(db);
      batch.set(doc(db, 'archivedProviders/photo-service'), {
        ...archive(),
        placePhoto,
      });
      batch.delete(doc(db, 'providers/photo-service'));
      return batch.commit();
    };
    await assertFails(unpublish({ ...photo, version: 'forged-version' }));
    await assertSucceeds(unpublish(photo));
    const batch = writeBatch(db);
    batch.set(doc(db, 'providers/photo-service'), {
      ...values(),
      ownerId: 'owner',
      publishedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'archivedProviders/photo-service'), {
      archiveStatus: 'restored',
      restoredAt: serverTimestamp(),
      restoredBy: 'admin-user',
    });
    await assertSucceeds(batch.commit());
  });
});

describe('admin unlimited creation and direct editing of any service', () => {
  it('allows an admin to create more than 3 services directly', async () => {
    const db = adminDb();
    for (let i = 1; i <= 5; i++) {
      await assertSucceeds(
        setDoc(doc(db, `providers/admin-direct-${i}`), {
          ...values({ serviceTitle: `خدمة مشرف ${i}` }),
          ownerId: 'admin-user',
          publishedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      );
    }
  });

  it('allows an admin to edit any published service while preserving ownerId and rejecting ownerId changes', async () => {
    const db = adminDb();
    await assertSucceeds(
      updateDoc(doc(db, 'providers/other-service'), {
        serviceTitle: 'تعديل مباشر من المشرف',
        updatedAt: serverTimestamp(),
      }),
    );
    const updated = await getDoc(doc(db, 'providers/other-service'));
    assert.equal(updated.data().ownerId, 'stranger');
    assert.equal(updated.data().serviceTitle, 'تعديل مباشر من المشرف');
    await assertFails(
      updateDoc(doc(db, 'providers/other-service'), {
        ownerId: 'admin-user',
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(ownerDb(), 'providers/other-service'), {
        serviceTitle: 'محاولة تعديل غير مصرح بها',
      }),
    );
  });

  it('allows an admin to edit an unpublished archived service in place without altering immutable archive fields', async () => {
    await seed({
      'archivedProviders/hidden-foreign': {
        ...values(),
        ownerId: 'stranger',
        publishedAt: yesterday,
        archiveStatus: 'unpublished',
        unpublishReason: 'راجع البيانات',
        unpublishedAt: yesterday,
        unpublishedBy: 'admin-user',
      },
    });
    const db = adminDb();
    await assertSucceeds(
      setDoc(doc(db, 'archivedProviders/hidden-foreign'), {
        ...values({ serviceTitle: 'تعديل أرشيف من المشرف' }),
        ownerId: 'stranger',
        publishedAt: yesterday,
        archiveStatus: 'unpublished',
        unpublishReason: 'راجع البيانات',
        unpublishedAt: yesterday,
        unpublishedBy: 'admin-user',
      }),
    );
    await assertFails(
      setDoc(doc(db, 'archivedProviders/hidden-foreign'), {
        ...values(),
        ownerId: 'admin-user',
        publishedAt: yesterday,
        archiveStatus: 'unpublished',
        unpublishReason: 'راجع البيانات',
        unpublishedAt: yesterday,
        unpublishedBy: 'admin-user',
      }),
    );
    await assertFails(
      setDoc(doc(db, 'archivedProviders/hidden-foreign'), {
        ...values({ categoryId: 'inactive' }),
        ownerId: 'stranger',
        publishedAt: yesterday,
        archiveStatus: 'unpublished',
        unpublishReason: 'راجع البيانات',
        unpublishedAt: yesterday,
        unpublishedBy: 'admin-user',
      }),
    );
    await assertFails(
      updateDoc(doc(strangerDb(), 'archivedProviders/hidden-foreign'), {
        serviceTitle: 'تعديل مباشر غير مسموح',
      }),
    );
  });
});

describe('photo provenance and server-managed field protection', () => {
  const approvedPhoto = {
    version: 'approvedv1',
    thumbnailUrl: 'https://res.cloudinary.com/sx5exugy/image/upload/thumb.jpg',
    detailUrl: 'https://res.cloudinary.com/sx5exugy/image/upload/detail.jpg',
    width: 1280,
    height: 960,
  };
  it('blocks admin client forging unapproved placePhoto, allows copying approvedPlacePhoto from active request or preserving existing photo', async () => {
    const db = adminDb();
    await assertFails(
      setDoc(doc(db, 'providers/forged-photo'), {
        ...values(),
        ownerId: 'owner',
        publishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        placePhoto: approvedPhoto,
      }),
    );
    await seed({
      'serviceRequests/approved-photo-req': {
        ...requestData({ providerId: 'approved-photo-service' }),
        createdAt: yesterday,
        updatedAt: yesterday,
        consentedAt: yesterday,
        photoReviewStatus: 'approved',
        approvedPlacePhoto: approvedPhoto,
      },
      'requestSlots/approved-photo-service': {
        ...slotData('approved-photo-req', 'approved-photo-service'),
        updatedAt: yesterday,
      },
    });
    await assertSucceeds(
      setDoc(doc(db, 'providers/approved-photo-service'), {
        ...values(),
        ownerId: 'owner',
        publishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        placePhoto: approvedPhoto,
      }),
    );
    await assertSucceeds(
      setDoc(doc(db, 'providers/approved-photo-service'), {
        ...values({ serviceTitle: 'تحديث النص فقط' }),
        ownerId: 'owner',
        publishedAt: yesterday,
        updatedAt: serverTimestamp(),
        placePhoto: approvedPhoto,
      }),
    );
    await assertFails(
      updateDoc(doc(db, 'providers/approved-photo-service'), {
        placePhoto: { ...approvedPhoto, version: 'forgedv2' },
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('prevents admin client updates from mutating server-managed photo review fields on serviceRequests', async () => {
    const db = adminDb();
    for (const patch of [
      { photoReviewStatus: 'approved' },
      { approvedPlacePhoto: approvedPhoto },
      { photoChange: { action: 'remove', expectedPhotoVersion: null } },
      { photoReviewReason: 'مزور' },
    ]) {
      await assertFails(
        updateDoc(doc(db, 'serviceRequests/owned-pending'), {
          ...patch,
          updatedAt: serverTimestamp(),
        }),
      );
    }
  });

  it('rejects account-delete photo cleanup jobs and allows admin service delete/unpublish jobs with providerId', async () => {
    const accountDeleteJob = {
      ownerId: 'owner',
      reason: 'account-delete',
      state: 'pending',
      createdAt: serverTimestamp(),
    };
    await assertFails(
      setDoc(doc(adminDb(), 'photoServiceCleanupJobs/acc-del'), accountDeleteJob),
    );
    await assertFails(
      setDoc(
        doc(ownerDb(), 'photoServiceCleanupJobs/owner-del'),
        accountDeleteJob,
      ),
    );
    await assertFails(
      setDoc(
        doc(guestDb(), 'photoServiceCleanupJobs/guest-del'),
        accountDeleteJob,
      ),
    );
    await assertSucceeds(
      setDoc(doc(adminDb(), 'photoServiceCleanupJobs/svc-del'), {
        ownerId: 'owner',
        providerId: 'owned-service',
        reason: 'delete',
        state: 'pending',
        createdAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      setDoc(doc(adminDb(), 'photoServiceCleanupJobs/svc-unpub'), {
        ownerId: 'owner',
        providerId: 'owned-service',
        reason: 'unpublish',
        state: 'pending',
        createdAt: serverTimestamp(),
      }),
    );
  });
});

describe('service ownership claims and transfer rules', () => {
  const claimPayload = (extra = {}) => ({
    providerId: 'admin-added-service',
    serviceName: 'مزود تجريبي',
    serviceTitle: 'سباك صحي',
    claimantId: 'stranger',
    claimantName: 'أحمد صاحب الخدمة',
    claimantPhone: '01099887766',
    note: 'ده رقم المحل بتاعي',
    status: 'pending',
    consent: true,
    consentedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  });

  beforeEach(async () => {
    await seed({
      'providers/admin-added-service': {
        ...values(),
        ownerId: 'admin-user',
        claimable: true,
        publishedAt: yesterday,
        updatedAt: yesterday,
      },
      'providers/regular-service': {
        ...values(),
        ownerId: 'owner',
        publishedAt: yesterday,
        updatedAt: yesterday,
      },
    });
  });

  it('allows a provider to submit a valid claim and blocks non-claimable services, admins, guests, and spoofing', async () => {
    const db = strangerDb();
    await assertSucceeds(
      setDoc(
        doc(db, 'serviceClaims/admin-added-service_stranger'),
        claimPayload(),
      ),
    );

    await seed({
      'providers/admin-spoof-target': {
        ...values(),
        ownerId: 'admin-user',
        claimable: true,
        publishedAt: yesterday,
        updatedAt: yesterday,
      },
    });
    const newProviderDb = environment
      .authenticatedContext('new-provider')
      .firestore();
    await assertSucceeds(
      setDoc(
        doc(newProviderDb, 'serviceClaims/admin-added-service_new-provider'),
        claimPayload({ claimantId: 'new-provider' }),
      ),
    );

    await assertFails(
      setDoc(
        doc(db, 'serviceClaims/regular-service_stranger'),
        claimPayload({ providerId: 'regular-service' }),
      ),
    );
    await assertFails(
      setDoc(doc(db, 'serviceClaims/wrong-doc-id'), claimPayload()),
    );
    await assertFails(
      setDoc(
        doc(db, 'serviceClaims/admin-spoof-target_stranger'),
        claimPayload({
          providerId: 'admin-spoof-target',
          serviceTitle: 'اسم مزور',
        }),
      ),
    );
    await assertFails(
      setDoc(
        doc(guestDb(), 'serviceClaims/admin-added-service_guest'),
        claimPayload({ claimantId: 'guest' }),
      ),
    );
    await assertFails(
      setDoc(
        doc(adminDb(), 'serviceClaims/admin-added-service_admin-user'),
        claimPayload({ claimantId: 'admin-user' }),
      ),
    );
  });

  it('enforces claim read isolation and allows resubmission only after rejection', async () => {
    await seed({
      'serviceClaims/admin-added-service_stranger': {
        ...claimPayload(),
        status: 'rejected',
        rejectionReason: 'راجع رقم الهاتف',
        reviewedBy: 'admin-user',
        reviewedAt: yesterday,
        consentedAt: yesterday,
        createdAt: yesterday,
        updatedAt: yesterday,
      },
    });

    await assertFails(
      getDoc(doc(ownerDb(), 'serviceClaims/admin-added-service_stranger')),
    );
    await assertSucceeds(
      getDoc(doc(strangerDb(), 'serviceClaims/admin-added-service_stranger')),
    );

    await assertSucceeds(
      setDoc(
        doc(strangerDb(), 'serviceClaims/admin-added-service_stranger'),
        claimPayload({ claimantPhone: '01122334455' }),
      ),
    );
  });

  it('allows admin atomic claim rejection with reason and atomic claim approval with ownership transfer', async () => {
    await seed({
      'serviceClaims/admin-added-service_stranger': {
        ...claimPayload(),
        consentedAt: yesterday,
        createdAt: yesterday,
        updatedAt: yesterday,
      },
      'requestSlots/admin-added-service': {
        ownerId: 'admin-user',
        providerId: 'admin-added-service',
        requestId: 'stale-admin-slot',
        updatedAt: yesterday,
      },
    });

    const aDb = adminDb();
    await assertFails(
      updateDoc(doc(aDb, 'serviceClaims/admin-added-service_stranger'), {
        status: 'rejected',
        rejectionReason: '   ',
        reviewedBy: 'admin-user',
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    await assertFails(
      updateDoc(doc(aDb, 'serviceClaims/admin-added-service_stranger'), {
        status: 'approved',
        reviewedBy: 'admin-user',
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    await assertFails(
      updateDoc(doc(aDb, 'providers/regular-service'), {
        ownerId: 'stranger',
        claimable: false,
        updatedAt: serverTimestamp(),
      }),
    );

    const approveBatch = writeBatch(aDb);
    approveBatch.update(doc(aDb, 'providers/admin-added-service'), {
      ownerId: 'stranger',
      claimable: false,
      updatedAt: serverTimestamp(),
    });
    approveBatch.delete(doc(aDb, 'requestSlots/admin-added-service'));
    approveBatch.update(
      doc(aDb, 'serviceClaims/admin-added-service_stranger'),
      {
        status: 'approved',
        reviewedBy: 'admin-user',
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    );
    await assertSucceeds(approveBatch.commit());

    await assertSucceeds(
      writeSubmission(strangerDb(), 'claimed-edit-req', {
        ownerId: 'stranger',
        providerId: 'admin-added-service',
        type: 'update',
        proposedData: values({ serviceTitle: 'تحديث بعد نقل الملكية' }),
      }),
    );

    await seed({
      'providers/admin-second-service': {
        ...values(),
        ownerId: 'admin-user',
        claimable: true,
        publishedAt: yesterday,
        updatedAt: yesterday,
      },
      'serviceClaims/admin-second-service_stranger': {
        ...claimPayload({ providerId: 'admin-second-service' }),
        consentedAt: yesterday,
        createdAt: yesterday,
        updatedAt: yesterday,
      },
    });

    await assertSucceeds(
      updateDoc(doc(aDb, 'serviceClaims/admin-second-service_stranger'), {
        status: 'rejected',
        rejectionReason: 'تعذر التحقق من ملكية الخدمة',
        reviewedBy: 'admin-user',
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });
});
