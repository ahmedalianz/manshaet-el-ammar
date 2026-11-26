import { auth } from '../../lib/firebase/auth';

export const getPhotoApiUrl = () => {
  const raw = process.env.EXPO_PUBLIC_PHOTO_API_URL?.trim().replace(
    /\/+$/,
    '',
  );
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?(\/|$)/i.test(raw))
    return `http://${raw}`;
  return `https://${raw}`;
};
export const photoApiUrl = getPhotoApiUrl();
export function photoErrorMessage(status: number, rawError?: string): string {
  const detail = (rawError ?? '').trim();
  if (status === 401) return 'جلستك انتهت. سجّل دخولك من جديد وجرّب تاني.';
  if (status === 403) return 'مش مسموح بالخطوة دي لحسابك.';
  if (status === 404) {
    if (/Endpoint not found/i.test(detail))
      return 'خدمة الصور على الخادم محتاجة تحديث. انشر آخر نسخة من خادم الصور وجرّب تاني.';
    if (/Service not found/i.test(detail))
      return 'الخدمة دي مش موجودة في الدليل حاليًا. حدّث الصفحة وجرّب تاني.';
    return 'الصورة دي مبقتش متاحة. اختار صورة تانية.';
  }
  if (status === 409) {
    if (/awaiting review/i.test(detail))
      return 'في صورة قيد المراجعة حاليًا للخدمة دي. استنى نتيجة المراجعة.';
    if (/changed/i.test(detail))
      return 'الصورة المنشورة اتحدّثت. حدّث الصفحة وجرّب تاني.';
    return 'حالة الصورة اتغيّرت. حدّث الصفحة وجرّب تاني.';
  }
  if (status === 413)
    return 'حجم الصورة كبير (أقصى حجم ٥٠٠ كيلوبايت). اختار صورة أصغر.';
  if (status === 415 || status === 422)
    return 'الصورة دي مش مدعومة أو أبعادها كبيرة. اختار صورة واضحة من المعرض.';
  if (status === 429)
    return 'وصلت للحد اليومي لرفع الصور (١٠ محاولات في اليوم). جرّب بكرة أو كمّل من غير صورة.';
  if (status === 503) {
    if (/processing paused/i.test(detail))
      return 'معالجة الصور متوقفة مؤقتًا حاليًا. جرّب تاني بعد شوية.';
    return 'رفع الصور متوقف مؤقتًا حاليًا. تقدر تبعت بيانات خدمتك من غير صورة.';
  }
  return 'مش قادرين نكمّل طلب الصورة دلوقتي. جرّب تاني أو كمّل من غير صورة.';
}
export type PhotoDraft = {
  action: 'keep' | 'replace' | 'remove';
  localUri?: string;
  candidateId?: string;
  submissionId?: string;
  uploaded?: boolean;
  needsCleanup?: boolean;
};
export async function photoRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const apiUrl = getPhotoApiUrl();
  if (!apiUrl || !auth?.currentUser)
    throw new Error('صور الخدمات مش متاحة حاليًا.');
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });
  const data = (await response.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
  };
  if (!response.ok)
    throw new Error(
      photoErrorMessage(response.status, data.error || data.message),
    );
  return data as T;
}
export async function uploadPhoto(
  candidateId: string,
  uri: string,
  onProgress: (progress: number) => void,
  signal: AbortSignal,
) {
  const apiUrl = getPhotoApiUrl();
  if (!apiUrl || !auth?.currentUser)
    throw new Error('صور الخدمات مش متاحة حاليًا.');
  const token = await auth.currentUser.getIdToken();
  const blob = await (await fetch(uri)).blob();
  if (blob.size > 500_000) throw new Error('الصورة كبيرة. اختار صورة أصغر.');
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    signal.addEventListener('abort', abort);
    xhr.open(
      'PUT',
      `${apiUrl}/v1/photos/candidates/${encodeURIComponent(candidateId)}`,
    );
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', 'image/jpeg');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    const finish = () => signal.removeEventListener('abort', abort);
    xhr.onload = () => {
      finish();
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        let rawError: string | undefined;
        try {
          const parsed = JSON.parse(xhr.responseText || '{}') as {
            error?: string;
            message?: string;
          };
          rawError = parsed.error || parsed.message;
        } catch {}
        reject(new Error(photoErrorMessage(xhr.status, rawError)));
      }
    };
    xhr.onerror = () => {
      finish();
      reject(new Error('اتأكد من الإنترنت وحاول رفع الصورة تاني.'));
    };
    xhr.onabort = () => {
      finish();
      reject(new Error('تم إلغاء رفع الصورة.'));
    };
    if (signal.aborted) {
      finish();
      reject(new Error('تم إلغاء رفع الصورة.'));
      return;
    }
    xhr.send(blob);
  });
}

export function reviewPhoto(
  requestId: string,
  decision: 'approved' | 'rejected',
  reason?: string,
) {
  return photoRequest(`/v1/photos/reviews/${encodeURIComponent(requestId)}`, {
    method: 'POST',
    body: JSON.stringify({ decision, ...(reason ? { reason } : {}) }),
  });
}
