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
  address: 'شارع المدارس، بجوار المسجد',
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
  const quotaRef = doc(db, 'serviceQuotas', data.ownerId);
  const quota = await getDoc(quotaRef);
  const batch = writeBatch(db);
  if (
    data.type === 'create' &&
    !(quota.data()?.serviceIds ?? []).includes(data.providerId)
  ) {
    batch.set(quotaRef, {
      ...quota.data(),
      serviceIds: [...(quota.data()?.serviceIds ?? []), data.providerId],
      updatedAt: serverTimestamp(),
    });
  }
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
    'serviceQuotas/owner': {
      serviceIds: ['owned-service', 'pending-service'],
      limit: 100,
      updatedAt: yesterday,
    },
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
  it('allows an admin to atomically remove the service, slot, submissions and quota reservation', async () => {
    const db = adminDb();
    await assertSucceeds(
      setDoc(doc(db, 'serviceQuotas/owner'), {
        serviceIds: ['pending-service', 'other'],
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      runTransaction(db, async (transaction) => {
        const quota = await transaction.get(doc(db, 'serviceQuotas/owner'));
        transaction.update(quota.ref, {
          serviceIds: quota
            .data()
            .serviceIds.filter((id) => id !== 'pending-service'),
          updatedAt: serverTimestamp(),
        });
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
    assert.deepEqual(
      (await getDoc(doc(db, 'serviceQuotas/owner'))).data().serviceIds,
      ['other'],
    );
  });
  it('allows admin unpublishing and releasing quota while preserving submissions', async () => {
    const db = adminDb();
    await assertSucceeds(
      setDoc(doc(db, 'serviceQuotas/owner'), {
        serviceIds: ['owned-service'],
        updatedAt: serverTimestamp(),
      }),
    );
    const batch = writeBatch(db);
    batch.delete(doc(db, 'providers/owned-service'));
    batch.update(doc(db, 'serviceQuotas/owner'), {
      serviceIds: [],
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
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
        const quotaRef = doc(db, 'serviceQuotas/owner');
        const quota = await transaction.get(quotaRef);
        if (slot.exists())
          throw new Error('A pending request already occupies the slot.');
        transaction.set(quotaRef, {
          ...quota.data(),
          serviceIds: [...quota.data().serviceIds, 'race-service'],
          updatedAt: serverTimestamp(),
        });
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

describe('service quota enforcement', () => {
  it('blocks a fourth reservation and cannot raise its own limit or remove IDs', async () => {
    await seed({
      'serviceQuotas/owner': {
        serviceIds: ['a', 'b', 'c'],
        updatedAt: yesterday,
      },
    });
    await assertFails(
      writeSubmission(ownerDb(), 'fourth', { providerId: 'fourth' }),
    );
    await assertFails(
      updateDoc(doc(ownerDb(), 'serviceQuotas/owner'), { limit: 4 }),
    );
    await assertFails(
      updateDoc(doc(ownerDb(), 'serviceQuotas/owner'), {
        serviceIds: [],
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(deleteDoc(doc(ownerDb(), 'serviceQuotas/owner')));
  });
  it('accepts three new services for a new owner and rejects a fourth', async () => {
    for (let i = 1; i <= 3; i++)
      await assertSucceeds(
        writeSubmission(strangerDb(), `quota-${i}`, {
          ownerId: 'stranger',
          providerId: `quota-${i}`,
        }),
      );
    await assertFails(
      writeSubmission(strangerDb(), 'quota-4', {
        ownerId: 'stranger',
        providerId: 'quota-4',
      }),
    );
  });
  it('rejects unreserved creations and fabricated quota-only writes', async () => {
    const db = ownerDb();
    const batch = writeBatch(db);
    batch.set(doc(db, 'serviceRequests/unreserved'), requestData());
    batch.set(doc(db, 'requestSlots/new-service'), slotData('unreserved'));
    await assertFails(batch.commit());
    await assertFails(
      updateDoc(doc(db, 'serviceQuotas/owner'), {
        serviceIds: ['owned-service', 'pending-service', 'fake'],
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('quota concurrency and support overrides', () => {
  it('only accepts one of two competing requests for the last slot', async () => {
    await seed({
      'serviceQuotas/owner': {
        serviceIds: ['owned-service', 'pending-service'],
        updatedAt: yesterday,
      },
    });
    const results = await Promise.allSettled(
      ['last-one', 'last-two'].map((id) =>
        writeSubmission(ownerDb(), id, { providerId: id }),
      ),
    );
    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      (await getDoc(doc(ownerDb(), 'serviceQuotas/owner'))).data().serviceIds
        .length,
      3,
    );
  });
  it('allows only an admin to increase the limit', async () => {
    await seed({
      'serviceQuotas/owner': {
        serviceIds: ['a', 'b', 'c'],
        updatedAt: yesterday,
      },
    });
    await assertSucceeds(
      updateDoc(doc(adminDb(), 'serviceQuotas/owner'), { limit: 4 }),
    );
    await assertSucceeds(
      writeSubmission(ownerDb(), 'support-fourth', {
        providerId: 'support-fourth',
      }),
    );
    await assertFails(getDoc(doc(strangerDb(), 'serviceQuotas/owner')));
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
  it('allows owner corrections only as pending restore requests with consent and quota', async () => {
    await seed({
      'archivedProviders/hidden': archived(),
      'serviceQuotas/owner': { serviceIds: [], updatedAt: yesterday },
      'categories/plumbing': { active: true },
    });
    const owner = environment.authenticatedContext('owner').firestore();
    const data = requestData({ providerId: 'hidden', type: 'restore' });
    const submit = async (extra = {}, reserve = true) => {
      const batch = writeBatch(owner);
      batch.set(doc(owner, 'serviceRequests', 'correction'), {
        ...data,
        ...extra,
      });
      batch.set(
        doc(owner, 'requestSlots', 'hidden'),
        slotData('correction', 'hidden'),
      );
      if (reserve)
        batch.set(doc(owner, 'serviceQuotas', 'owner'), {
          serviceIds: ['hidden'],
          updatedAt: serverTimestamp(),
        });
      return batch.commit();
    };
    await assertFails(submit({ consent: false }));
    await assertFails(submit({}, false));
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
  it('allows a travelling provider to omit a home address but requires coverage and explicit mode', async () => {
    const owner = ownerDb();
    const legacy = values();
    delete legacy.serviceMode;
    await assertFails(
      writeSubmission(owner, 'no-mode', { proposedData: legacy }),
    );
    await assertFails(
      writeSubmission(owner, 'no-coverage', {
        proposedData: values({ serviceMode: 'mobile', address: '' }),
      }),
    );
    await assertSucceeds(
      writeSubmission(owner, 'mobile-request', {
        proposedData: values({
          serviceMode: 'mobile',
          coverageAreas: ['all'],
          address: '',
        }),
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
          coverageAreas: ['وسط البلد'],
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
  it('enforces deletion consent and type-specific staff transitions with a required rejection reason', async () => {
    const ref = doc(ownerDb(), 'supportRequests', 'deletion');
    const data = {
      ownerId: 'owner',
      kind: 'deletion',
      message: 'طلب مراجعة الحذف',
      status: 'received',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await assertFails(setDoc(ref, data));
    await assertSucceeds(
      setDoc(ref, { ...data, consent: true, consentedAt: serverTimestamp() }),
    );
    const adminRef = doc(adminDb(), 'supportRequests', 'deletion');
    const review = (status) => ({
      status,
      staffNote: '',
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await assertFails(updateDoc(adminRef, review('resolved')));
    await assertFails(updateDoc(adminRef, review('rejected')));
    await assertSucceeds(updateDoc(adminRef, review('in_review')));
    await assertSucceeds(updateDoc(adminRef, review('awaiting_verification')));
    await assertSucceeds(updateDoc(adminRef, review('ready_for_deletion')));
    await assertFails(updateDoc(adminRef, review('received')));
  });
});
