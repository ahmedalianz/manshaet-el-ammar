import {
  collection,
  deleteField,
  doc,
  getDocFromServer,
  getDocsFromServer,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Firestore,
} from '@firebase/firestore';
import { readWithDeadline } from '../../lib/network';
import { firebaseMessage } from '../auth/errors';
import { mapServiceClaim } from '../provider/firebaseMapping';
import type { ClaimStatus, ServiceClaim } from '../provider/types';
import { normalizeMobile, validateMobile } from '../provider/validation';

function checkedDocId(id: string): string {
  if (!id || id.length > 128 || !/^[A-Za-z0-9_-]+$/.test(id))
    throw new Error('مش قادرين نفتح البيانات دي. حدّث الصفحة وجرّب تاني.');
  return id;
}

function checkedClaimDocId(id: string): string {
  if (!id || id.length > 260 || !/^[A-Za-z0-9_-]+$/.test(id))
    throw new Error('مش قادرين نفتح طلب الملكية ده. حدّث الصفحة وجرّب تاني.');
  return id;
}

export function claimDocumentId(providerId: string, uid: string): string {
  return `${checkedDocId(providerId)}_${checkedDocId(uid)}`;
}

export async function submitServiceClaim(
  db: Firestore,
  uid: string,
  input: {
    providerId: string;
    claimantName: string;
    claimantPhone: string;
    note?: string;
    consent: boolean;
  },
): Promise<string> {
  checkedDocId(uid);
  const providerId = checkedDocId(input.providerId);
  if (!input.consent) {
    throw new Error('لازم تأكّد إن الخدمة تخصّك قبل إرسال الطلب.');
  }
  const claimantName = input.claimantName.trim();
  if (!claimantName || claimantName.length > 100) {
    throw new Error('اكتب اسمك الكامل، بحد أقصى ١٠٠ حرف.');
  }
  const phoneError = validateMobile(input.claimantPhone);
  if (phoneError) {
    throw new Error(phoneError);
  }
  const claimantPhone = normalizeMobile(input.claimantPhone);
  const note = (input.note ?? '').trim();
  if (note.length > 1000) {
    throw new Error('التوضيح الإضافي لازم يكون ١٠٠٠ حرف أو أقل.');
  }

  const claimId = claimDocumentId(providerId, uid);
  const claimRef = doc(db, 'serviceClaims', claimId);
  const providerRef = doc(db, 'providers', providerId);

  await runTransaction(db, async (transaction) => {
    const [provider, existing] = await Promise.all([
      transaction.get(providerRef),
      transaction.get(claimRef),
    ]);

    if (!provider.exists() || provider.data().claimable !== true) {
      throw new Error('الخدمة دي مش متاحة لطلب نقل الملكية.');
    }
    const providerData = provider.data();
    if (providerData.ownerId === uid) {
      throw new Error('الخدمة دي مسجلة باسم حسابك بالفعل.');
    }

    if (existing.exists()) {
      const status = existing.data().status;
      if (status === 'pending') {
        throw new Error(
          'بعتّ طلب نقل للخدمة دي قبل كده وهو قيد المراجعة حاليًا.',
        );
      }
      if (status === 'approved') {
        throw new Error('تم نقل الخدمة دي لحسابك بالفعل.');
      }
    }

    const serviceName =
      typeof providerData.displayName === 'string' &&
      providerData.displayName.trim()
        ? providerData.displayName.trim().slice(0, 100)
        : 'خدمة';
    const serviceTitle =
      typeof providerData.serviceTitle === 'string' &&
      providerData.serviceTitle.trim()
        ? providerData.serviceTitle.trim().slice(0, 160)
        : serviceName;

    const now = serverTimestamp();
    transaction.set(claimRef, {
      providerId,
      serviceName,
      serviceTitle,
      claimantId: uid,
      claimantName,
      claimantPhone,
      note,
      status: 'pending',
      consent: true,
      consentedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  });

  return claimId;
}

export async function fetchMyServiceClaim(
  db: Firestore,
  providerId: string,
  uid: string,
): Promise<ServiceClaim | null> {
  const claimId = claimDocumentId(providerId, uid);
  const snapshot = await readWithDeadline(
    getDocFromServer(doc(db, 'serviceClaims', claimId)),
  );
  if (!snapshot.exists()) return null;
  return mapServiceClaim(snapshot.id, snapshot.data());
}

export async function fetchMyServiceClaims(
  db: Firestore,
  uid: string,
): Promise<ServiceClaim[]> {
  checkedDocId(uid);
  const snapshot = await readWithDeadline(
    getDocsFromServer(
      query(
        collection(db, 'serviceClaims'),
        where('claimantId', '==', uid),
        limit(50),
      ),
    ),
  );
  return snapshot.docs
    .map((item) => mapServiceClaim(item.id, item.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function fetchAdminServiceClaims(
  db: Firestore,
  status?: ClaimStatus,
): Promise<ServiceClaim[]> {
  const snapshot = await readWithDeadline(
    getDocsFromServer(
      query(
        collection(db, 'serviceClaims'),
        ...(status ? [where('status', '==', status)] : []),
        limit(100),
      ),
    ),
  );
  return snapshot.docs
    .map((item) => mapServiceClaim(item.id, item.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function fetchServiceClaim(
  db: Firestore,
  id: string,
): Promise<ServiceClaim | null> {
  const claimId = checkedClaimDocId(id);
  const snapshot = await readWithDeadline(
    getDocFromServer(doc(db, 'serviceClaims', claimId)),
  );
  if (!snapshot.exists()) return null;
  return mapServiceClaim(snapshot.id, snapshot.data());
}

export async function reviewServiceClaim(
  db: Firestore,
  reviewerId: string,
  claimId: string,
  decision: 'approved' | 'rejected',
  reason = '',
): Promise<void> {
  checkedDocId(reviewerId);
  const validClaimId = checkedClaimDocId(claimId);
  const claimRef = doc(db, 'serviceClaims', validClaimId);

  if (decision === 'rejected') {
    const trimmedReason = reason.trim();
    if (!trimmedReason || trimmedReason.length > 1000) {
      throw new Error('اكتب سبب الرفض، بحد أقصى ١٠٠٠ حرف.');
    }
    await runTransaction(db, async (transaction) => {
      const claim = await transaction.get(claimRef);
      if (!claim.exists() || claim.data().status !== 'pending') {
        throw new Error('الطلب اتراجع قبل كده أو مبقاش متاح. حدّث القائمة.');
      }
      transaction.update(claimRef, {
        status: 'rejected',
        rejectionReason: trimmedReason,
        reviewedBy: reviewerId,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    return;
  }

  const initialClaim = await readWithDeadline(getDocFromServer(claimRef));
  if (!initialClaim.exists() || initialClaim.data().status !== 'pending') {
    throw new Error('الطلب اتراجع قبل كده أو مبقاش متاح. حدّث القائمة.');
  }
  const initialProviderId = checkedDocId(
    String(initialClaim.data().providerId),
  );
  const competingQuery = await readWithDeadline(
    getDocsFromServer(
      query(
        collection(db, 'serviceClaims'),
        where('providerId', '==', initialProviderId),
        limit(50),
      ),
    ),
  );
  const competingRefs = competingQuery.docs
    .filter((entry) => entry.id !== validClaimId)
    .map((entry) => entry.ref);

  await runTransaction(db, async (transaction) => {
    const claim = await transaction.get(claimRef);
    if (!claim.exists() || claim.data().status !== 'pending') {
      throw new Error('الطلب اتراجع قبل كده أو مبقاش متاح. حدّث القائمة.');
    }
    const claimData = claim.data();
    const providerId = checkedDocId(String(claimData.providerId));
    const claimantId = checkedDocId(String(claimData.claimantId));

    const providerRef = doc(db, 'providers', providerId);
    const slotRef = doc(db, 'requestSlots', providerId);

    const [provider, slot, ...competingSnaps] =
      await Promise.all([
        transaction.get(providerRef),
        transaction.get(slotRef),
        ...competingRefs.map((ref) => transaction.get(ref)),
      ]);

    if (!provider.exists()) {
      throw new Error('الخدمة دي مش منشورة حاليًا.');
    }
    const providerData = provider.data();
    if (providerData.claimable !== true) {
      throw new Error('الخدمة دي مبقتش متاحة لنقل الملكية.');
    }
    const previousOwnerId =
      typeof providerData.ownerId === 'string' &&
      /^[A-Za-z0-9_-]{1,128}$/.test(providerData.ownerId)
        ? providerData.ownerId
        : undefined;
    if (previousOwnerId === claimantId) {
      throw new Error('الخدمة دي مسجلة باسم صاحب الطلب بالفعل.');
    }

    const pendingRequestId =
      slot.exists() &&
      typeof slot.data().requestId === 'string' &&
      /^[A-Za-z0-9_-]{1,128}$/.test(slot.data().requestId)
        ? slot.data().requestId
        : null;
    const pendingRequestRef = pendingRequestId
      ? doc(db, 'serviceRequests', pendingRequestId)
      : null;

    const pendingSlotRequest = pendingRequestRef
      ? await transaction.get(pendingRequestRef)
      : null;

    const now = serverTimestamp();
    transaction.update(providerRef, {
      ownerId: claimantId,
      claimable: false,
      updatedAt: now,
    });
    if (slot.exists()) {
      if (
        pendingSlotRequest?.exists() &&
        pendingSlotRequest.data().status === 'pending' &&
        pendingRequestRef
      ) {
        transaction.update(pendingRequestRef, {
          status: 'rejected',
          rejectionReason: 'تم نقل ملكية الخدمة لصاحبها.',
          reviewedBy: reviewerId,
          reviewedAt: now,
          updatedAt: now,
        });
      }
      transaction.delete(slotRef);
    }
    transaction.update(claimRef, {
      status: 'approved',
      reviewedBy: reviewerId,
      reviewedAt: now,
      updatedAt: now,
    });
    for (const other of competingSnaps) {
      if (other.exists() && other.data().status === 'pending') {
        transaction.update(other.ref, {
          status: 'rejected',
          rejectionReason: 'تم التأكد من ملكية الخدمة ونقلها لصاحبها الفعلي.',
          reviewedBy: reviewerId,
          reviewedAt: now,
          updatedAt: now,
        });
      }
    }
  });
}

function legacyAreaCleanup(data: Record<string, unknown>) {
  return {
    ...('areaId' in data ? { areaId: deleteField() } : {}),
    ...('areadId' in data ? { areadId: deleteField() } : {}),
    ...('area' in data ? { area: deleteField() } : {}),
  };
}

export async function syncAdminClaimableDetailed(
  db: Firestore,
  adminUid: string,
  unmigratedIds: string[],
): Promise<{
  updatedIds: string[];
  failedCount: number;
  lastError: string | null;
}> {
  checkedDocId(adminUid);
  const updatedIds: string[] = [];
  let failedCount = 0;
  let lastError: string | null = null;
  for (const rawId of unmigratedIds) {
    const providerId = checkedDocId(rawId);
    const providerRef = doc(db, 'providers', providerId);
    const slotRef = doc(db, 'requestSlots', providerId);
    try {
      const changed = await runTransaction(db, async (transaction) => {
        const [provider, slot] = await Promise.all([
          transaction.get(providerRef),
          transaction.get(slotRef),
        ]);
        if (
          !provider.exists() ||
          provider.data().ownerId !== adminUid ||
          provider.data().claimable !== undefined ||
          (slot.exists() && slot.data().ownerId !== adminUid)
        ) {
          return false;
        }
        const providerData = provider.data();
        transaction.update(providerRef, {
          ...legacyAreaCleanup(providerData),
          claimable: true,
        });
        return true;
      });
      if (changed) updatedIds.push(providerId);
    } catch (error) {
      failedCount += 1;
      lastError = firebaseMessage(error);
    }
  }
  return { updatedIds, failedCount, lastError };
}

export async function syncAdminClaimableServices(
  db: Firestore,
  adminUid: string,
  unmigratedIds: string[],
): Promise<number> {
  const result = await syncAdminClaimableDetailed(db, adminUid, unmigratedIds);
  return result.updatedIds.length;
}

export async function setProviderClaimable(
  db: Firestore,
  adminUid: string,
  providerId: string,
  claimable: boolean,
): Promise<void> {
  checkedDocId(adminUid);
  const validId = checkedDocId(providerId);
  const providerRef = doc(db, 'providers', validId);
  await runTransaction(db, async (transaction) => {
    const provider = await transaction.get(providerRef);
    if (!provider.exists()) {
      throw new Error('الخدمة دي مش منشورة حاليًا.');
    }
    const providerData = provider.data();
    transaction.update(providerRef, {
      ...legacyAreaCleanup(providerData),
      claimable: Boolean(claimable),
    });
  });
}
