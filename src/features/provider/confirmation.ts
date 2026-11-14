import {
  doc,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from '@firebase/firestore';
import { timestampISO } from './firebaseMapping';
export const CONFIRMATION_INTERVAL_MS = 90 * 24 * 60 * 60 * 1000;
export function confirmationDue(lastConfirmedAt?: string, now = Date.now()) {
  return (
    !lastConfirmedAt ||
    !Number.isFinite(Date.parse(lastConfirmedAt)) ||
    now - Date.parse(lastConfirmedAt) >= CONFIRMATION_INTERVAL_MS
  );
}
export async function confirmProviderDetails(
  db: Firestore,
  uid: string,
  id: string,
  expectedUpdatedAt: string,
) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('الخدمة مش متاحة.');
  const ref = doc(db, 'providers', id);
  await runTransaction(db, async (transaction) => {
    const current = await transaction.get(ref);
    if (!current.exists()) throw new Error('الخدمة مبقتش متاحة في الدليل.');
    const data = current.data();
    if (data.ownerId !== uid) throw new Error('الخدمة دي مش تابعة لحسابك.');
    if (timestampISO(data.updatedAt ?? data.publishedAt) !== expectedUpdatedAt)
      throw new Error('البيانات اتغيرت. حدّث الخدمة وراجعها تاني قبل التأكيد.');
    transaction.update(ref, { lastConfirmedAt: serverTimestamp() });
  });
}
