import {
  addDoc,
  collection,
  doc,
  getDocFromServer,
  serverTimestamp,
  type Firestore,
} from '@firebase/firestore';
import { readWithDeadline } from '../../lib/network';

export async function submitServiceReport(
  db: Firestore,
  reporterId: string,
  providerId: string,
  reason: string,
): Promise<string> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(reporterId))
    throw new Error('سجّل دخولك قبل إرسال البلاغ.');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(providerId))
    throw new Error('معرّف الخدمة مش صحيح. ارجع وافتح الخدمة من الدليل.');
  const trimmed = reason.trim();
  if (!trimmed || trimmed.length > 1000)
    throw new Error('اكتب سبب البلاغ، بحد أقصى ١٠٠٠ حرف.');
  const provider = await readWithDeadline(
    getDocFromServer(doc(db, 'providers', providerId)),
  );
  if (!provider.exists())
    throw new Error('الخدمة مبقتش متاحة في الدليل. حدّث الصفحة وجرّب تاني.');
  // Status is intentionally omitted: report creation allows these four fields,
  // and the admin repository interprets a newly submitted report as open.
  const report = await addDoc(collection(db, 'reports'), {
    providerId,
    reporterId,
    reason: trimmed,
    createdAt: serverTimestamp(),
  });
  return report.id;
}
