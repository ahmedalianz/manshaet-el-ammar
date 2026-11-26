import { localDirectory, isTransientReadError } from '../local/LocalDirectory';
import { validateAvailability } from '../availability/validation';
import { readWithDeadline } from '../../lib/network';
import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  getCountFromServer,
  startAfter,
  documentId,
  type QueryDocumentSnapshot,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Firestore,
} from '@firebase/firestore';
import type { ServiceValues } from './types';
import {
  mapCategory,
  mapArchivedProvider,
  mapOwnedProvider,
  mapProvider,
  mapRequest,
  storedValuesMatch,
  toStoredValues,
} from './firebaseMapping';

async function fetchCategoriesFromServer(db: Firestore) {
  const snapshot = await readWithDeadline(
    getDocsFromServer(
      query(
        collection(db, 'categories'),
        where('active', '==', true),
        orderBy('order'),
        limit(100),
      ),
    ),
  );
  return snapshot.docs.map((item) => mapCategory(item.id, item.data()));
}
export type ProviderCursor = QueryDocumentSnapshot | undefined;
export type ProviderPage = {
  items: ReturnType<typeof mapProvider>[];
  nextCursor: ProviderCursor;
};
function providerQuery(db: Firestore, categoryId?: string) {
  return query(
    collection(db, 'providers'),
    ...(categoryId ? [where('categoryId', '==', categoryId)] : []),
    orderBy('publishedAt', 'desc'),
    orderBy(documentId(), 'desc'),
  );
}
async function fetchProviderPage(
  db: Firestore,
  size: number,
  categoryId?: string,
  cursor?: ProviderCursor,
): Promise<ProviderPage> {
  const snapshot = await readWithDeadline(
    getDocsFromServer(
      query(
        providerQuery(db, categoryId),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(size),
      ),
    ),
  );
  return {
    items: snapshot.docs.map((item) => mapProvider(item.id, item.data())),
    nextCursor:
      snapshot.docs.length === size ? snapshot.docs.at(-1) : undefined,
  };
}
async function fetchPublicProvidersFromServer(
  db: Firestore,
  cursor?: ProviderCursor,
) {
  return fetchProviderPage(db, 100, undefined, cursor);
}
async function fetchCategoryProvidersFromServer(
  db: Firestore,
  id: string,
  cursor?: ProviderCursor,
) {
  return fetchProviderPage(db, 50, id, cursor);
}
export async function fetchProviderTotal(db: Firestore, categoryId?: string) {
  const snapshot = await readWithDeadline(
    getCountFromServer(providerQuery(db, categoryId)),
  );
  return snapshot.data().count;
}
async function fetchProviderFromServer(db: Firestore, id: string) {
  const item = await readWithDeadline(
    getDocFromServer(doc(db, 'providers', checkedId(id))),
  );
  return item.exists() ? mapProvider(item.id, item.data()) : null;
}
export async function fetchMyProviders(db: Firestore, uid: string) {
  const snapshot = await readWithDeadline(
    getDocsFromServer(
      query(
        collection(db, 'providers'),
        where('ownerId', '==', uid),
        orderBy('updatedAt', 'desc'),
        limit(100),
      ),
    ),
  );
  const archived = await readWithDeadline(
    getDocsFromServer(
      query(
        collection(db, 'archivedProviders'),
        where('ownerId', '==', uid),
        where('archiveStatus', '==', 'unpublished'),
        orderBy('unpublishedAt', 'desc'),
        limit(100),
      ),
    ),
  );
  return [
    ...snapshot.docs.map((item) => mapOwnedProvider(item.id, item.data(), uid)),
    ...archived.docs.map((item) =>
      mapArchivedProvider(item.id, item.data(), uid),
    ),
  ];
}
export async function fetchMyRequests(db: Firestore, uid: string) {
  const snapshot = await readWithDeadline(
    getDocsFromServer(
      query(
        collection(db, 'serviceRequests'),
        where('ownerId', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(100),
      ),
    ),
  );
  return snapshot.docs.map((item) => mapRequest(item.id, item.data(), uid));
}
export async function fetchProfile(
  db: Firestore,
  uid: string,
): Promise<{ name: string } | null> {
  const snapshot = await readWithDeadline(
    getDocFromServer(doc(db, 'users', checkedId(uid))),
  );
  if (!snapshot.exists()) return null;
  const name: unknown = snapshot.data().displayName;
  if (typeof name !== 'string' || !name.trim() || name.length > 100)
    throw new Error('في بيانات مش صحيحة في حسابك. راجعها وجرّب تاني.');
  return { name: name.trim() };
}
function checkedId(id: string): string {
  if (!id || id.length > 128 || !/^[A-Za-z0-9_-]+$/.test(id))
    throw new Error('مش قادرين نفتح البيانات دي. حدّث الصفحة وجرّب تاني.');
  return id;
}
export async function submitRequest(
  db: Firestore,
  uid: string,
  values: ServiceValues,
  id?: string,
  submissionId?: string,
  consent = false,
): Promise<string> {
  checkedId(uid);
  if (!consent) throw new Error('لازم توافق على عرض البيانات قبل الإرسال.');
  if (Object.keys(validateAvailability(values, true)).length)
    throw new Error('راجع طريقة تقديم الخدمة والمواعيد.');
  const proposedData = toStoredValues(values);
  const requestId = checkedId(
    submissionId ?? doc(collection(db, 'serviceRequests')).id,
  );
  const providerId = checkedId(id ?? `provider-${requestId}`);
  const requestRef = doc(db, 'serviceRequests', requestId);
  const slotRef = doc(db, 'requestSlots', providerId);
  const providerRef = doc(db, 'providers', providerId);
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(requestRef);
    const slot = await transaction.get(slotRef);
    const provider = await transaction.get(providerRef);
    const archive = await transaction.get(
      doc(db, 'archivedProviders', providerId),
    );
    const restoring =
      archive.exists() && archive.data().archiveStatus === 'unpublished';
    const category = await transaction.get(
      doc(db, 'categories', checkedId(values.categoryId)),
    );
    const previousId: unknown = slot.exists()
      ? slot.data().requestId
      : undefined;
    const previous =
      typeof previousId === 'string' && previousId !== requestId
        ? await transaction.get(
            doc(db, 'serviceRequests', checkedId(previousId)),
          )
        : undefined;
    if (existing.exists()) {
      const data = existing.data();
      if (
        data.ownerId !== uid ||
        data.providerId !== providerId ||
        !storedValuesMatch(data.proposedData, proposedData) ||
        JSON.stringify(data.photoChange ?? { action: 'keep' }) !==
          JSON.stringify(values.photoChange ?? { action: 'keep' })
      )
        throw new Error('معرّف الإرسال مستخدم لطلب مختلف. ابدأ محاولة جديدة.');
      return;
    }
    if (!category.exists() || category.data().active !== true)
      throw new Error('القسم ده غير متاح حاليًا. اختار قسم تاني.');
    if (slot.exists() && slot.data().ownerId !== uid)
      throw new Error('الخدمة دي مش متاحة لحسابك.');
    if (restoring && archive.data().ownerId !== uid)
      throw new Error('الخدمة دي مش متاحة لحسابك.');
    if (provider.exists() && provider.data().ownerId !== uid)
      throw new Error('الخدمة دي مش متاحة لحسابك.');
    if (previous?.exists() && previous.data().status === 'pending')
      throw new Error(
        'في طلب للخدمة دي مستني المراجعة. استنى النتيجة قبل ما تبعت طلب جديد.',
      );
    if (
      id &&
      !provider.exists() &&
      !restoring &&
      (!previous?.exists() ||
        previous.data().ownerId !== uid ||
        previous.data().type !== 'create' ||
        previous.data().status !== 'rejected')
    )
      throw new Error('الخدمة أو الطلب السابق غير متاح.');
    const now = serverTimestamp();
    transaction.set(requestRef, {
      ownerId: uid,
      providerId,
      type: restoring ? 'restore' : provider.exists() ? 'update' : 'create',
      status: 'pending',
      proposedData,
      ...(values.photoChange && values.photoChange.action !== 'keep'
        ? { photoChange: values.photoChange, photoReviewStatus: 'pending' }
        : {}),
      createdAt: now,
      updatedAt: now,
      consent: true,
      consentedAt: now,
    });
    if (proposedData.weeklyHours) {
      for (const chunk of ['0', '1', '2', '3'])
        transaction.set(
          doc(db, 'serviceRequests', requestId, 'scheduleValidation', chunk),
          { ownerId: uid, createdAt: now },
        );
    }
    transaction.set(slotRef, {
      ownerId: uid,
      providerId,
      requestId,
      updatedAt: now,
      ...(proposedData.weeklyHours
        ? { weeklyHours: proposedData.weeklyHours }
        : {}),
    });
  });
  return providerId;
}
export async function updateProfile(
  db: Firestore,
  uid: string,
  name: string,
): Promise<void> {
  const displayName = name.trim();
  if (!displayName || displayName.length > 100)
    throw new Error('اكتب اسمك، بحد أقصى ١٠٠ حرف.');
  const reference = doc(db, 'users', checkedId(uid));
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(reference);
    if (existing.exists())
      transaction.update(reference, {
        displayName,
        updatedAt: serverTimestamp(),
      });
    else
      transaction.set(reference, {
        displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
  });
}

export async function fetchCategories(db: Firestore) {
  await localDirectory.hydrate();
  try {
    const items = await fetchCategoriesFromServer(db);
    localDirectory.rememberCategories(items);
    return items;
  } catch (error) {
    if (isTransientReadError(error)) {
      const cached = localDirectory.getCachedCategories();
      if (cached.length) return cached;
    }
    throw error;
  }
}
async function publicPage(
  db: Firestore,
  categoryId?: string,
  cursor?: ProviderCursor,
): Promise<ProviderPage> {
  await localDirectory.hydrate();
  try {
    const page = categoryId
      ? await fetchCategoryProvidersFromServer(db, categoryId, cursor)
      : await fetchPublicProvidersFromServer(db, cursor);
    localDirectory.rememberProviders(page.items);
    return page;
  } catch (error) {
    if (isTransientReadError(error) && !cursor) {
      const items = localDirectory
        .getCachedProviders()
        .filter((item) => !categoryId || item.categoryId === categoryId);
      if (items.length) return { items, nextCursor: undefined };
    }
    throw error;
  }
}
export function fetchPublicProviders(db: Firestore, cursor?: ProviderCursor) {
  return publicPage(db, undefined, cursor);
}
export function fetchCategoryProviders(
  db: Firestore,
  id: string,
  cursor?: ProviderCursor,
) {
  return publicPage(db, id, cursor);
}
export async function fetchProvider(db: Firestore, id: string) {
  checkedId(id);
  await localDirectory.hydrate();
  try {
    const item = await fetchProviderFromServer(db, id);
    if (item) localDirectory.rememberProviders([item]);
    else localDirectory.markUnavailable(id);
    return item;
  } catch (error) {
    if (isTransientReadError(error)) {
      const cached = localDirectory.getCachedProvider(id);
      if (cached) return cached;
    }
    throw error;
  }
}
