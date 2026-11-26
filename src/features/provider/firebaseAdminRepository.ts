import { getPhotoApiUrl, photoRequest } from '../photos/api';
import { validateAvailability } from '../availability/validation';
import { readWithDeadline } from '../../lib/network';
import {
  collection,
  doc,
  getDocFromServer,
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
  toStoredValues,
} from './firebaseMapping';
import type { PublishedService, ServiceReport, ServiceValues } from './types';

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
  const photoRequests = await readWithDeadline(
    getDocsFromServer(
      query(
        collection(db, 'serviceRequests'),
        where('photoReviewStatus', '==', 'pending'),
        limit(100),
      ),
    ),
  );
  const combinedRequests = [
    ...new Map(
      [...requests.docs, ...photoRequests.docs].map((item) => [item.id, item]),
    ).values(),
  ];
  return {
    requests: combinedRequests.map((item) =>
      mapRequest(item.id, item.data(), item.data().ownerId),
    ),
    services: [
      ...providers.docs.map<PublishedService>((item) => {
        const data = item.data();
        return {
          ...mapOwnedProvider(item.id, data, data.ownerId),
          ...(data.claimable !== undefined
            ? { claimable: Boolean(data.claimable) }
            : {}),
          publicationStatus: 'published',
        };
      }),
      ...archived.docs.map<PublishedService>((item) => {
        const data = item.data();
        return {
          ...mapArchivedProvider(item.id, data, data.ownerId),
          ...(data.claimable !== undefined
            ? { claimable: Boolean(data.claimable) }
            : {}),
          publicationStatus: 'unpublished',
        };
      }),
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
  let restorePhotoTarget: string | undefined;
  await runTransaction(db, async (transaction) => {
    restorePhotoTarget = undefined;
    const request = await transaction.get(requestRef);
    if (!request.exists() || request.data().status !== 'pending')
      throw new Error('الطلب اتراجع قبل كده أو مبقاش متاح. حدّث القائمة.');
    const data = request.data();
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
      if (
        data.type === 'restore' &&
        data.photoReviewStatus !== 'approved' &&
        Boolean(archive.data()?.placePhoto)
      ) {
        restorePhotoTarget = data.providerId;
      }
      transaction.set(providerRef, {
        ...publicValues,
        ...(provider.exists()
          ? provider.data().placePhoto
            ? { placePhoto: provider.data().placePhoto }
            : {}
          : data.photoReviewStatus === 'approved' && data.approvedPlacePhoto
            ? { placePhoto: data.approvedPlacePhoto }
            : {}),
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
      }
    }
    transaction.update(requestRef, {
      status: decision,
      reviewedBy: reviewerId,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(decision === 'rejected' ? { rejectionReason: reason.trim() } : {}),
    });
  });
  if (restorePhotoTarget && getPhotoApiUrl()) {
    try {
      await photoRequest(
        `/v1/photos/services/${encodeURIComponent(restorePhotoTarget)}/restore`,
        { method: 'POST' },
      );
    } catch {
      /* Service is restored safely with category artwork; photo recovery can be retried. */
    }
  }
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
    const slot = await transaction.get(reference(db, 'requestSlots', id));
    const pendingRef = slot.exists()
      ? reference(db, 'serviceRequests', slot.data().requestId)
      : null;
    const pending = pendingRef ? await transaction.get(pendingRef) : null;
    transaction.set(reference(db, 'archivedProviders', id), {
      ...publicProjection(data),
      ...(data.claimable !== undefined
        ? { claimable: Boolean(data.claimable) }
        : {}),
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
    transaction.set(doc(collection(db, 'photoServiceCleanupJobs')), {
      providerId: id,
      ownerId: data.ownerId,
      reason: 'unpublish',
      state: 'pending',
      createdAt: serverTimestamp(),
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
    ...(source.placePhoto ? { placePhoto: source.placePhoto } : {}),
    displayName: source.displayName,
    categoryId: source.categoryId,
    serviceTitle: source.serviceTitle,
    description: source.description,
    phone: source.phone,

    address: source.address,
    ...(source.serviceMode ? { serviceMode: source.serviceMode } : {}),
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
    // Archived public delivery URLs are invalidated on unpublish.
    delete (projection as { placePhoto?: unknown }).placePhoto;
    transaction.set(providerRef, {
      ...projection,
      ...(data.claimable !== undefined
        ? { claimable: Boolean(data.claimable) }
        : {}),
      ownerId: data.ownerId,
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.update(archiveRef, {
      archiveStatus: 'restored',
      restoredBy: reviewerId,
      restoredAt: serverTimestamp(),
    });
  });
  if (getPhotoApiUrl()) {
    try {
      await photoRequest(
        `/v1/photos/services/${encodeURIComponent(id)}/restore`,
        { method: 'POST' },
      );
    } catch {
      /* Service is restored safely with category artwork; photo recovery can be retried. */
    }
  }
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
    if (ownerId)
      transaction.set(doc(collection(db, 'photoServiceCleanupJobs')), {
        providerId: id,
        ownerId,
        reason: 'delete',
        state: 'pending',
        createdAt: serverTimestamp(),
      });
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

export async function fetchAdminService(
  db: Firestore,
  id: string,
): Promise<PublishedService | null> {
  const providerRef = reference(db, 'providers', id);
  const archiveRef = reference(db, 'archivedProviders', id);
  const [provider, archive] = await Promise.all([
    readWithDeadline(getDocFromServer(providerRef)),
    readWithDeadline(getDocFromServer(archiveRef)),
  ]);
  if (provider.exists()) {
    const data = provider.data();
    if (typeof data.ownerId !== 'string')
      throw new Error('في بيانات مش صحيحة في الخدمة. راجعها وجرّب تاني.');
    return {
      ...mapOwnedProvider(provider.id, data, data.ownerId),
      ...(data.claimable !== undefined
        ? { claimable: Boolean(data.claimable) }
        : {}),
      publicationStatus: 'published',
    };
  }
  if (archive.exists() && archive.data().archiveStatus === 'unpublished') {
    const data = archive.data();
    if (typeof data.ownerId !== 'string')
      throw new Error('في بيانات مش صحيحة في الخدمة. راجعها وجرّب تاني.');
    return {
      ...mapArchivedProvider(archive.id, data, data.ownerId),
      ...(data.claimable !== undefined
        ? { claimable: Boolean(data.claimable) }
        : {}),
      publicationStatus: 'unpublished',
    };
  }
  return null;
}

export async function saveAdminProvider(
  db: Firestore,
  adminUid: string,
  values: ServiceValues,
  id?: string,
  submissionId?: string,
): Promise<string> {
  reference(db, 'users', adminUid);
  if (Object.keys(validateAvailability(values, true)).length)
    throw new Error('راجع طريقة تقديم الخدمة والمواعيد.');
  const stored = toStoredValues(values);
  const publicValues = publicProjection(stored);
  const seed = submissionId
    ? reference(db, 'serviceRequests', submissionId).id
    : doc(collection(db, 'serviceRequests')).id;
  const providerId = id
    ? reference(db, 'providers', id).id
    : `provider-${seed}`;
  const providerRef = reference(db, 'providers', providerId);
  const archiveRef = reference(db, 'archivedProviders', providerId);
  const slotRef = reference(db, 'requestSlots', providerId);
  const categoryRef = reference(db, 'categories', stored.categoryId);
  await runTransaction(db, async (transaction) => {
    const [provider, archive, slot, category] = await Promise.all([
      transaction.get(providerRef),
      transaction.get(archiveRef),
      transaction.get(slotRef),
      transaction.get(categoryRef),
    ]);
    const requestId: unknown = slot.exists()
      ? slot.data().requestId
      : undefined;
    const pendingRef =
      typeof requestId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(requestId)
        ? reference(db, 'serviceRequests', requestId)
        : null;
    const pending = pendingRef ? await transaction.get(pendingRef) : null;
    if (!category.exists() || category.data().active !== true)
      throw new Error('القسم ده غير متاح حاليًا. اختار قسم تاني.');
    if (!id) {
      if (provider.exists()) {
        if (provider.data().ownerId !== adminUid)
          throw new Error('معرّف الخدمة مستخدم بالفعل. جرّب تاني.');
        const current = provider.data();
        transaction.set(providerRef, {
          ...publicValues,
          ...(current.placePhoto ? { placePhoto: current.placePhoto } : {}),
          ...(current.location ? { location: current.location } : {}),
          ...(current.lastConfirmedAt
            ? { lastConfirmedAt: current.lastConfirmedAt }
            : {}),
          ownerId: adminUid,
          publishedAt: current.publishedAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return;
      }
      if (archive.exists() && archive.data().archiveStatus === 'unpublished')
        throw new Error('الخدمة دي موجودة في الأرشيف.');
      transaction.set(providerRef, {
        ...publicValues,
        ownerId: adminUid,
        claimable: true,
        publishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }
    const removePhotoInline =
      values.photoChange?.action === 'remove' && !getPhotoApiUrl();
    if (provider.exists()) {
      const current = provider.data();
      transaction.set(providerRef, {
        ...publicValues,
        ...(current.placePhoto && !removePhotoInline
          ? { placePhoto: current.placePhoto }
          : {}),
        ...(current.location ? { location: current.location } : {}),
        ...(current.lastConfirmedAt
          ? { lastConfirmedAt: current.lastConfirmedAt }
          : {}),
        ...(current.claimable !== undefined
          ? { claimable: Boolean(current.claimable) }
          : current.ownerId === adminUid &&
              (!slot.exists() || slot.data().ownerId === adminUid)
            ? { claimable: true }
            : {}),
        ownerId: current.ownerId,
        publishedAt: current.publishedAt,
        updatedAt: serverTimestamp(),
      });
    } else if (
      archive.exists() &&
      archive.data().archiveStatus === 'unpublished'
    ) {
      const current = archive.data();
      transaction.set(archiveRef, {
        ...publicValues,
        ...(current.placePhoto && !removePhotoInline
          ? { placePhoto: current.placePhoto }
          : {}),
        ...(current.location ? { location: current.location } : {}),
        ...(current.claimable !== undefined
          ? { claimable: Boolean(current.claimable) }
          : {}),
        ownerId: current.ownerId,
        publishedAt: current.publishedAt,
        archiveStatus: 'unpublished',
        unpublishReason: current.unpublishReason,
        unpublishedAt: current.unpublishedAt,
        unpublishedBy: current.unpublishedBy,
      });
    } else {
      throw new Error('الخدمة دي مش موجودة أو اتحذفت. حدّث القائمة.');
    }
    if (
      pending?.exists() &&
      pending.data().status === 'pending' &&
      pendingRef
    ) {
      transaction.update(pendingRef, {
        status: 'rejected',
        rejectionReason: 'تم تحديث بيانات الخدمة مباشرة بواسطة مشرف الدليل.',
        reviewedBy: adminUid,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  });
  if (
    getPhotoApiUrl() &&
    values.photoChange &&
    (values.photoChange.action === 'replace' ||
      values.photoChange.action === 'remove')
  ) {
    await photoRequest(
      `/v1/photos/services/${encodeURIComponent(providerId)}/photo`,
      {
        method: 'POST',
        body: JSON.stringify(values.photoChange),
      },
    );
  }
  return providerId;
}

export async function hasRecoverableServicePhoto(
  db: Firestore,
  id: string,
): Promise<boolean> {
  const providerRef = reference(db, 'providers', id);
  const archiveRef = reference(db, 'archivedProviders', id);
  const [provider, archive] = await Promise.all([
    readWithDeadline(getDocFromServer(providerRef)),
    readWithDeadline(getDocFromServer(archiveRef)),
  ]);
  return Boolean(
    provider.exists() &&
    !('placePhoto' in provider.data()) &&
    archive.exists() &&
    archive.data().archiveStatus === 'restored' &&
    archive.data().placePhoto,
  );
}

export async function retryRestoreServicePhoto(id: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id))
    throw new Error('مش قادرين نفتح البيانات دي. حدّث الصفحة وجرّب تاني.');
  if (!getPhotoApiUrl()) throw new Error('صور الخدمات مش متاحة حاليًا.');
  await photoRequest(`/v1/photos/services/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
  });
}
