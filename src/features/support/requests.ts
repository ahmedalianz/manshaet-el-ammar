import { readWithDeadline } from '../../lib/network';
import { timestampISO } from '../provider/firebaseMapping';
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
export type RequestKind = 'support';
export type RequestStatus = 'received' | 'in_review' | 'resolved' | 'rejected';
export type SupportRequest = {
  id: string;
  ownerId: string;
  kind: RequestKind;
  message: string;
  status: RequestStatus;
  staffNote?: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
};
export const statusLabels: Record<RequestStatus, string> = {
  received: 'تم الاستلام',
  in_review: 'قيد المراجعة',
  resolved: 'تم الحل',
  rejected: 'مرفوض',
};
export function nextStatuses(status: RequestStatus): RequestStatus[] {
  if (status === 'received') return ['in_review', 'rejected'];
  if (status === 'in_review') return ['resolved', 'rejected'];
  return [];
}
function reference(db: Firestore, id: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('رقم الطلب غير صحيح');
  return doc(db, 'supportRequests', id);
}
export function allocateSupportId(db: Firestore) {
  return doc(collection(db, 'supportRequests')).id;
}
export async function submitSupportRequest(
  db: Firestore,
  id: string,
  ownerId: string,
  message: string,
) {
  const text = message.trim();
  if (!ownerId || !text || text.length > 2000)
    throw new Error('اكتب تفاصيل الطلب، بحد أقصى ٢٠٠٠ حرف');
  const ref = reference(db, id);
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists()) {
      const data = existing.data();
      if (
        data.ownerId !== ownerId ||
        data.kind !== 'support' ||
        data.message !== text
      )
        throw new Error('رقم الطلب مستخدم بالفعل؛ راجع طلباتك');
      return;
    }
    transaction.set(ref, {
      ownerId,
      kind: 'support',
      message: text,
      status: 'received',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  return id;
}
export async function fetchSupportRequests(db: Firestore, ownerId?: string) {
  const result = await readWithDeadline(
    getDocsFromServer(
      query(
        collection(db, 'supportRequests'),
        ...(ownerId ? [where('ownerId', '==', ownerId)] : []),
        orderBy('createdAt', 'desc'),
        limit(50),
      ),
    ),
  );
  return result.docs
    .filter((item) => item.data().kind === 'support')
    .map((item) => mapSupportRequest(item.id, item.data()));
}
export async function fetchSupportRequest(db: Firestore, id: string) {
  const item = await readWithDeadline(getDocFromServer(reference(db, id)));
  if (!item.exists() || item.data().kind !== 'support')
    throw new Error('الطلب غير موجود أو غير متاح لحسابك');
  return mapSupportRequest(item.id, item.data());
}
export async function reviewSupportRequest(
  db: Firestore,
  id: string,
  status: RequestStatus,
  note: string,
) {
  const staffNote = note.trim();
  if (staffNote.length > 2000 || (status === 'rejected' && !staffNote))
    throw new Error('اكتب سبب الرفض، بحد أقصى ٢٠٠٠ حرف');
  await runTransaction(db, async (transaction) => {
    const ref = reference(db, id);
    const item = await transaction.get(ref);
    if (!item.exists()) throw new Error('الطلب غير موجود');
    const current = item.data() as SupportRequest;
    if (
      current.kind !== 'support' ||
      !nextStatuses(current.status).includes(status)
    )
      throw new Error('حالة الطلب اتغيرت؛ حدّث الصفحة');
    transaction.update(ref, {
      status,
      staffNote,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

function mapSupportRequest(
  id: string,
  data: Record<string, unknown>,
): SupportRequest {
  if (
    typeof data.ownerId !== 'string' ||
    data.kind !== 'support' ||
    typeof data.message !== 'string' ||
    data.message.length > 2000 ||
    !Object.keys(statusLabels).includes(String(data.status))
  )
    throw new Error('في مشكلة في بيانات الطلب. حدّث الصفحة وجرّب تاني.');
  return {
    id,
    ownerId: data.ownerId,
    kind: 'support',
    message: data.message,
    status: data.status as RequestStatus,
    createdAt: timestampISO(data.createdAt),
    updatedAt: timestampISO(data.updatedAt),
    ...(data.reviewedAt ? { reviewedAt: timestampISO(data.reviewedAt) } : {}),
    ...(typeof data.staffNote === 'string'
      ? { staffNote: data.staffNote }
      : {}),
  };
}
