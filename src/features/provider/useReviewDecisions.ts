import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import type { ProviderListing, ServiceRequest } from './types';

export const reviewDecisionKey = (request: ServiceRequest) =>
  JSON.stringify([
    request.id,
    request.status,
    request.reviewedAt ?? request.createdAt,
  ]);
export const reviewSeenStorageKey = (uid: string) =>
  `manshaet.review-decisions.v1.${uid}`;

// Keep the latest finished review for each owned listing. Admins can see other
// owners' requests in context, but those must never enter this private inbox.
export function latestReviewDecisions(
  uid: string,
  listings: ProviderListing[],
  requests: ServiceRequest[],
) {
  const owned = new Set(
    listings.filter((item) => item.ownerId === uid).map((item) => item.id),
  );
  const latest = new Map<string, ServiceRequest>();
  for (const request of [...requests]
    .filter(
      (item) =>
        item.ownerId === uid &&
        owned.has(item.providerId) &&
        item.status !== 'pending',
    )
    .sort(
      (a, b) =>
        (b.reviewedAt ?? b.createdAt).localeCompare(
          a.reviewedAt ?? a.createdAt,
        ) || b.id.localeCompare(a.id),
    )) {
    if (!latest.has(request.providerId))
      latest.set(request.providerId, request);
  }
  return [...latest.values()];
}
export function reviewDecisionMessage(request: ServiceRequest) {
  const subject =
    request.type === 'update'
      ? 'التعديلات'
      : request.type === 'restore'
        ? 'طلب إعادة النشر'
        : 'طلب إضافة الخدمة';
  return request.status === 'approved'
    ? `تمت الموافقة على ${subject}`
    : `تم رفض ${subject}`;
}

type Seen = { uid: string; keys: string[]; error: string | null };
export function useReviewDecisions(
  uid: string | null,
  listings: ProviderListing[],
  requests: ServiceRequest[],
) {
  const [seen, setSeen] = useState<Seen | null>(null);
  const current = useRef<Seen | null>(null);
  const writes = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    if (!uid) return;
    let active = true;
    AsyncStorage.getItem(reviewSeenStorageKey(uid))
      .then((raw) => {
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (
          !Array.isArray(parsed) ||
          !parsed.every((item) => typeof item === 'string')
        )
          throw new Error('Invalid stored decisions');
        if (active) {
          const next = { uid, keys: parsed as string[], error: null };
          current.current = next;
          setSeen(next);
        }
      })
      .catch(() => {
        if (active) {
          const next = {
            uid,
            keys: [],
            error: 'تعذر تحميل حالة الاطلاع على نتائج المراجعة.',
          };
          current.current = next;
          setSeen(next);
        }
      });
    return () => {
      active = false;
    };
  }, [uid]);
  const ready = Boolean(uid && seen?.uid === uid);
  const unread =
    uid && ready
      ? latestReviewDecisions(uid, listings, requests).filter(
          (request) => !seen!.keys.includes(reviewDecisionKey(request)),
        )
      : [];
  const acknowledge = (request: ServiceRequest) => {
    if (
      !uid ||
      !ready ||
      request.ownerId !== uid ||
      current.current?.uid !== uid
    )
      return;
    const next = {
      uid,
      keys: [...new Set([...current.current.keys, reviewDecisionKey(request)])],
      error: null,
    };
    current.current = next;
    setSeen(next);
    // Serialize rapid acknowledgements so an earlier write cannot erase a later one.
    writes.current = writes.current
      .catch(() => {})
      .then(() =>
        AsyncStorage.setItem(
          reviewSeenStorageKey(uid),
          JSON.stringify(next.keys),
        ),
      )
      .then(() => {
        if (current.current?.uid === uid)
          setSeen((value) =>
            value?.uid === uid && value.error
              ? { ...value, error: null }
              : value,
          );
      })
      .catch(() => {
        if (current.current?.uid === uid)
          setSeen((value) =>
            value?.uid === uid
              ? {
                  ...value,
                  error:
                    'تعذر حفظ حالة الاطلاع. قد تظهر التحديثات مرة أخرى بعد إعادة فتح التطبيق.',
                }
              : value,
          );
      });
  };
  return { unread, acknowledge, persistenceError: ready ? seen?.error : null };
}
