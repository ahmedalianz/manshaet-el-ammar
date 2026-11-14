import { reserveService } from './serviceLimit';
import { readWithDeadline } from '../../lib/network';
import {
  collection,
  doc,
  getDocsFromServer,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Firestore,
} from '@firebase/firestore';
import {
  fromStoredValues,
  mapOwnedProvider,
  mapArchivedProvider,
  mapProvider,
  mapRequest,
  timestampISO,
} from './firebaseMapping';
import type { PublishedService, ServiceReport } from './types';

export async function fetchModeration(db: Firestore) {
  const [requests, providers, reports, archived] = await Promise.all([
    readWithDeadline(
      getDocsFromServer(
        query(
          collection(db, 'serviceRequests'),
          where('status', '==', 'pending'),
          limit(100),
        ),
      ),
    ),
    readWithDeadline(
      getDocsFromServer(
        query(
          collection(db, 'providers'),
          orderBy('publishedAt', 'desc'),
          limit(100),
        ),
      ),
    ),
    readWithDeadline(
      getDocsFromServer(
        query(
          collection(db, 'reports'),
          orderBy('createdAt', 'desc'),
          limit(100),
        ),
      ),
    ),
    readWithDeadline(
      getDocsFromServer(
        query(
          collection(db, 'archivedProviders'),
          where('archiveStatus', '==', 'unpublished'),
          orderBy('unpublishedAt', 'desc'),
          limit(100),
        ),
      ),
    ),
  ]);
  return {
    requests: requests.docs.map((item) =>
      mapRequest(item.id, item.data(), item.data().ownerId),
    ),
    services: [
      ...providers.docs.map<PublishedService>((item) => ({
        ...mapOwnedProvider(item.id, item.data(), item.data().ownerId),
        publicationStatus: 'published',
      })),
      ...archived.docs.map<PublishedService>((item) => ({
        ...mapArchivedProvider(item.id, item.data(), item.data().ownerId),
        publicationStatus: 'unpublished',
      })),
    ],
    reports: reports.docs.map<ServiceReport>((item) => {
      const data = item.data();
      if (
        typeof data.providerId !== 'string' ||
        typeof data.reason !== 'string'
      )
        throw new Error('في بيانات مش صحيحة في البلاغ. راجعها وجرّب تاني.');
      return {
        id: item.id,
        providerId: data.providerId,
        reason: data.reason,
        status: data.status === 'closed' ? 'closed' : 'open',
        createdAt: timestampISO(data.createdAt),
        ...(data.closedAt ? { closedAt: timestampISO(data.closedAt) } : {}),
      };
    }),
  };
}
function reference(db: Firestore, collectionName: string, id: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id))
    throw new Error('مش قادرين نفتح البيانات دي. حدّث الصفحة وجرّب تاني.');
  return doc(db, collectionName, id);
}
export async function reviewRequest(
  db: Firestore,
  reviewerId: string,
  id: string,
  decision: 'approved' | 'rejected',
  reason = '',
) {
  if (
    decision === 'rejected' &&
    (!reason.trim() || reason.trim().length > 1000)
  )
    throw new Error('اكتب سبب الرفض، بحد أقصى ١٠٠٠ حرف.');
  const requestRef = reference(db, 'serviceRequests', id);
  await runTransaction(db, async (transaction) => {
    const request = await transaction.get(requestRef);
    if (!request.exists() || request.data().status !== 'pending')
      throw new Error('الطلب اتراجع قبل كده أو مبقاش متاح. حدّث القائمة.');
    const data = request.data();
    const quotaRef = reference(db, 'serviceQuotas', data.ownerId);
    const quota = await transaction.get(quotaRef);
    const providerRef = reference(db, 'providers', data.providerId);
    const slot = await transaction.get(
      reference(db, 'requestSlots', data.providerId),
    );
    const provider = await transaction.get(providerRef);
    const archiveRef = reference(db, 'archivedProviders', data.providerId);
    const archive = await transaction.get(archiveRef);
    if (
      !slot.exists() ||
      slot.data().requestId !== id ||
      slot.data().ownerId !== data.ownerId
    )
      throw new Error('في طلب أحدث للخدمة دي. حدّث القائمة.');
    if (decision === 'approved') {
      if (data.consent !== true)
        throw new Error('موافقة صاحب الخدمة على النشر غير متاحة.');
      fromStoredValues(data.proposedData);
      const category = await transaction.get(
        reference(db, 'categories', data.proposedData.categoryId),
      );
      if (!category.exists() || category.data().active !== true)
        throw new Error('قسم الخدمة غير متاح حاليًا.');
      if (
        (data.type === 'create' &&
          (provider.exists() ||
            (archive.exists() &&
              archive.data().archiveStatus === 'unpublished'))) ||
        (data.type === 'update' &&
          (!provider.exists() || provider.data().ownerId !== data.ownerId)) ||
        (data.type === 'restore' &&
          (provider.exists() ||
            !archive.exists() ||
            archive.data().archiveStatus !== 'unpublished' ||
            archive.data().ownerId !== data.ownerId)) ||
        !['create', 'update', 'restore'].includes(data.type)
      )
        throw new Error('حالة الخدمة اتغيّرت، ومش هنقدر ننشر الطلب ده.');
      // Explicit public projection: never copy private request metadata to providers.
      const source = data.proposedData;
      const publicValues = publicProjection(source);
      const restoredQuota =
        data.type === 'restore'
          ? reserveService(
              quota.exists() ? quota.data() : undefined,
              data.providerId,
            )
          : undefined;
      transaction.set(providerRef, {
        ...publicValues,
        ownerId: data.ownerId,
        publishedAt: provider.exists()
          ? provider.data().publishedAt
          : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (data.type === 'restore') {
        transaction.update(archiveRef, {
          archiveStatus: 'restored',
          restoredBy: reviewerId,
          restoredAt: serverTimestamp(),
        });
        transaction.set(quotaRef, {
          ...(quota.exists() ? quota.data() : {}),
          serviceIds: restoredQuota,
          updatedAt: serverTimestamp(),
        });
      }
    }
    if (decision === 'rejected' && !provider.exists() && quota.exists()) {
      transaction.update(quotaRef, {
        serviceIds: quota
          .data()
          .serviceIds.filter(
            (serviceId: string) => serviceId !== data.providerId,
          ),
        updatedAt: serverTimestamp(),
      });
    }
    transaction.update(requestRef, {
      status: decision,
      reviewedBy: reviewerId,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(decision === 'rejected' ? { rejectionReason: reason.trim() } : {}),
    });
  });
}
export async function unpublishProvider(
  db: Firestore,
  reviewerId: string,
  id: string,
  reason: string,
) {
  if (!reason?.trim() || reason.trim().length > 1000)
    throw new Error('اكتب سبب إخفاء الخدمة، بحد أقصى ١٠٠٠ حرف.');
  const ref = reference(db, 'providers', id);
  await runTransaction(db, async (transaction) => {
    const provider = await transaction.get(ref);
    if (!provider.exists()) throw new Error('الخدمة دي مش منشورة أصلًا.');
    const data = provider.data();
    const quotaRef = reference(db, 'serviceQuotas', data.ownerId);
    const quota = await transaction.get(quotaRef);
    const slot = await transaction.get(reference(db, 'requestSlots', id));
    const pendingRef = slot.exists()
      ? reference(db, 'serviceRequests', slot.data().requestId)
      : null;
    const pending = pendingRef ? await transaction.get(pendingRef) : null;
    transaction.set(reference(db, 'archivedProviders', id), {
      ...publicProjection(data),
      ownerId: data.ownerId,
      publishedAt: data.publishedAt,
      archiveStatus: 'unpublished',
      unpublishReason: reason.trim(),
      unpublishedAt: serverTimestamp(),
      unpublishedBy: reviewerId,
    });
    if (pending?.exists() && pending.data().status === 'pending' && pendingRef)
      transaction.update(pendingRef, {
        status: 'rejected',
        rejectionReason: reason.trim(),
        reviewedBy: reviewerId,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    if (quota.exists())
      transaction.update(quotaRef, {
        serviceIds: quota
          .data()
          .serviceIds.filter((serviceId: string) => serviceId !== id),
        updatedAt: serverTimestamp(),
      });
    transaction.delete(ref);
  });
}
// Rebuild only the validated public projection, never moderation metadata.
function publicProjection(source: Record<string, unknown>) {
  const mapped = mapProvider('projection', {
    ...source,
    updatedAt: undefined,
    publishedAt: undefined,
    lastConfirmedAt: undefined,
  });
  return {
    displayName: source.displayName,
    categoryId: source.categoryId,
    serviceTitle: source.serviceTitle,
    description: source.description,
    phone: source.phone,

    address: source.address,
    ...(source.serviceMode ? { serviceMode: source.serviceMode } : {}),
    ...(source.coverageAreas ? { coverageAreas: source.coverageAreas } : {}),
    ...(source.weeklyHours ? { weeklyHours: source.weeklyHours } : {}),
    ...(source.whatsapp ? { whatsapp: source.whatsapp } : {}),
    ...(mapped.latitude !== undefined && mapped.longitude !== undefined
      ? { location: { latitude: mapped.latitude, longitude: mapped.longitude } }
      : {}),
  };
}
export async function restoreProvider(
  db: Firestore,
  reviewerId: string,
  id: string,
) {
  const archiveRef = reference(db, 'archivedProviders', id);
  const providerRef = reference(db, 'providers', id);
  await runTransaction(db, async (transaction) => {
    const archive = await transaction.get(archiveRef);
    const provider = await transaction.get(providerRef);
    if (
      !archive.exists() ||
      archive.data().archiveStatus !== 'unpublished' ||
      provider.exists()
    )
      throw new Error(
        'الخدمة مش في الأرشيف أو رجعت للدليل قبل كده. حدّث القائمة.',
      );
    const data = archive.data();
    const quotaRef = reference(db, 'serviceQuotas', data.ownerId);
    const quota = await transaction.get(quotaRef);
    const slot = await transaction.get(reference(db, 'requestSlots', id));
    const pending = slot.exists()
      ? await transaction.get(
          reference(db, 'serviceRequests', slot.data().requestId),
        )
      : null;
    const category = await transaction.get(
      reference(db, 'categories', String(data.categoryId)),
    );
    if (pending?.exists() && pending.data().status === 'pending')
      throw new Error(
        'في تصحيح مستني المراجعة. راجعه الأول قبل استرجاع الخدمة.',
      );
    if (!category.exists() || category.data().active !== true)
      throw new Error('قسم الخدمة مش متاح دلوقتي.');
    const projection = publicProjection(data);
    const serviceIds = reserveService(
      quota.exists() ? quota.data() : undefined,
      id,
    );
    transaction.set(providerRef, {
      ...projection,
      ownerId: data.ownerId,
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.update(archiveRef, {
      archiveStatus: 'restored',
      restoredBy: reviewerId,
      restoredAt: serverTimestamp(),
    });
    transaction.set(quotaRef, {
      ...(quota.exists() ? quota.data() : {}),
      serviceIds,
      updatedAt: serverTimestamp(),
    });
  });
}
// Delete the service and its submissions atomically so owner history cannot
// reconstruct a removed listing or a pending edit republish it.
export async function deleteProvider(db: Firestore, id: string) {
  const providerRef = reference(db, 'providers', id);
  const slotRef = reference(db, 'requestSlots', id);
  const requests = await readWithDeadline(
    getDocsFromServer(
      query(
        collection(db, 'serviceRequests'),
        where('providerId', '==', id),
        limit(401),
      ),
    ),
  );
  if (requests.size > 400)
    throw new Error('للخدمة سجل كبير. احذفها من Firebase Console.');
  await runTransaction(db, async (transaction) => {
    const provider = await transaction.get(providerRef);
    const slot = await transaction.get(slotRef);
    const archiveRef = reference(db, 'archivedProviders', id);
    const archive = await transaction.get(archiveRef);
    const history = await Promise.all(
      requests.docs.map((request) => transaction.get(request.ref)),
    );
    const historyWrites = history.reduce(
      (count, entry) =>
        count +
        1 +
        (entry.exists() && entry.data().proposedData?.weeklyHours ? 4 : 0),
      0,
    );
    if (historyWrites > 490)
      throw new Error('للخدمة سجل كبير. محتاجين نحذفها بأداة الإدارة.');
    if (
      !provider.exists() &&
      !slot.exists() &&
      !archive.exists() &&
      !history.some((request) => request.exists())
    )
      throw new Error('الخدمة اتحذفت قبل كده. حدّث القائمة.');
    if (
      slot.exists() &&
      !requests.docs.some((request) => request.id === slot.data().requestId)
    )
      throw new Error(
        'وصل طلب جديد للخدمة. حدّث القائمة وحاول الحذف مرة تانية.',
      );
    const ownerId = provider.exists()
      ? provider.data().ownerId
      : archive.exists()
        ? archive.data().ownerId
        : slot.exists()
          ? slot.data().ownerId
          : history.find((request) => request.exists())?.data()?.ownerId;
    const quotaRef = reference(db, 'serviceQuotas', ownerId);
    const quota = await transaction.get(quotaRef);
    if (quota.exists())
      transaction.update(quotaRef, {
        serviceIds: quota
          .data()
          .serviceIds.filter((serviceId: string) => serviceId !== id),
        updatedAt: serverTimestamp(),
      });
    for (const [index, request] of requests.docs.entries()) {
      if (
        history[index].exists() &&
        history[index].data().proposedData?.weeklyHours
      )
        for (const chunk of ['0', '1', '2', '3'])
          transaction.delete(
            doc(db, 'serviceRequests', request.id, 'scheduleValidation', chunk),
          );
      transaction.delete(request.ref);
    }
    if (archive.exists()) transaction.delete(archiveRef);
    transaction.delete(slotRef);
    transaction.delete(providerRef);
  });
}
export async function resolveReport(
  db: Firestore,
  reviewerId: string,
  id: string,
) {
  const ref = reference(db, 'reports', id);
  await runTransaction(db, async (transaction) => {
    const report = await transaction.get(ref);
    if (!report.exists() || report.data().status === 'closed')
      throw new Error('البلاغ مغلق أو غير متاح.');
    transaction.update(ref, {
      status: 'closed',
      closedAt: serverTimestamp(),
      closedBy: reviewerId,
    });
  });
}
