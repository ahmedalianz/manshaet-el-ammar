import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { db } from '../../lib/firebase/firestore';
import { firebaseMessage } from '../auth/errors';
import { fetchAdminService } from '../provider/firebaseAdminRepository';
import { useProviderState } from '../provider/ProviderContext';
import type {
  ClaimStatus,
  PublishedService,
  ServiceClaim,
} from '../provider/types';
import {
  fetchAdminServiceClaims,
  fetchMyServiceClaim,
  fetchMyServiceClaims,
  fetchServiceClaim,
} from './claimsRepository';

let claimVersion = 0;
const listeners = new Set<() => void>();

export function notifyClaimsChanged() {
  claimVersion += 1;
  for (const listener of listeners) listener();
}

function useClaimVersion() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => claimVersion,
    () => claimVersion,
  );
}

export function useMyProviderClaim(providerId?: string) {
  const { userId, role, claims } = useProviderState();
  const version = useClaimVersion();
  const enabled = Boolean(
    db &&
    userId &&
    !userId.startsWith('demo-') &&
    role !== 'admin' &&
    providerId,
  );
  const [remote, setRemote] = useState<{
    key: string;
    data: ServiceClaim | null;
    error: string | null;
  } | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const currentKey = enabled
    ? `${userId}:${providerId}:${version}:${reloadTick}`
    : '';

  useEffect(() => {
    if (!enabled || !db || !userId || !providerId) return;
    let active = true;
    fetchMyServiceClaim(db, providerId, userId)
      .then((data) => {
        if (active) setRemote({ key: currentKey, data, error: null });
      })
      .catch((cause) => {
        if (active)
          setRemote({
            key: currentKey,
            data: null,
            error: firebaseMessage(cause),
          });
      });
    return () => {
      active = false;
    };
  }, [enabled, userId, providerId, currentKey]);

  const mockClaim =
    !db && userId && providerId
      ? (claims?.find(
          (item) =>
            item.providerId === providerId && item.claimantId === userId,
        ) ?? null)
      : null;

  return {
    claim: db ? (remote?.key === currentKey ? remote.data : null) : mockClaim,
    loading: enabled && remote?.key !== currentKey,
    error: db && remote?.key === currentKey ? remote.error : null,
    retry: () => setReloadTick((n) => n + 1),
  };
}

export function useMyClaims() {
  const { userId, role, claims } = useProviderState();
  const version = useClaimVersion();
  const enabled = Boolean(
    db && userId && !userId.startsWith('demo-') && role !== 'admin',
  );
  const [remote, setRemote] = useState<{
    key: string;
    items: ServiceClaim[];
    error: string | null;
  } | null>(null);
  const currentKey = enabled ? `${userId}:${version}` : '';

  useEffect(() => {
    if (!enabled || !db || !userId) return;
    let active = true;
    fetchMyServiceClaims(db, userId)
      .then((items) => {
        if (active) setRemote({ key: currentKey, items, error: null });
      })
      .catch((cause) => {
        if (active)
          setRemote({
            key: currentKey,
            items: [],
            error: firebaseMessage(cause),
          });
      });
    return () => {
      active = false;
    };
  }, [enabled, userId, currentKey]);

  const mockItems =
    !db && userId && role !== 'admin'
      ? (claims ?? [])
          .filter((item) => item.claimantId === userId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      : [];

  return {
    claims: db ? (remote?.key === currentKey ? remote.items : []) : mockItems,
    loading: enabled && remote?.key !== currentKey,
    error: db && remote?.key === currentKey ? remote.error : null,
  };
}

export function useAdminClaims(status?: ClaimStatus) {
  const { userId, role, claims, pendingClaims } = useProviderState();
  const version = useClaimVersion();
  const enabled = Boolean(
    db && userId && !userId.startsWith('demo-') && role === 'admin',
  );
  const [remote, setRemote] = useState<{
    key: string;
    items: ServiceClaim[];
    error: string | null;
  } | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const currentKey = enabled
    ? `${userId}:${status ?? 'all'}:${version}:${reloadTick}`
    : '';

  useEffect(() => {
    if (!enabled || !db) return;
    let active = true;
    fetchAdminServiceClaims(db, status)
      .then((items) => {
        if (active) setRemote({ key: currentKey, items, error: null });
      })
      .catch((cause) => {
        if (active)
          setRemote({
            key: currentKey,
            items: [],
            error: firebaseMessage(cause),
          });
      });
    return () => {
      active = false;
    };
  }, [enabled, status, currentKey]);

  const mockSource =
    status === 'pending' && pendingClaims ? pendingClaims : (claims ?? []);
  const mockItems =
    !db && role === 'admin'
      ? mockSource
          .filter((item) => !status || item.status === status)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      : [];

  return {
    claims: db ? (remote?.key === currentKey ? remote.items : []) : mockItems,
    loading: enabled && remote?.key !== currentKey,
    error: db && remote?.key === currentKey ? remote.error : null,
    retry: () => setReloadTick((n) => n + 1),
  };
}

export function useAdminClaimDetails(claimId?: string) {
  const { userId, role, claims, services = [] } = useProviderState();
  const version = useClaimVersion();
  const enabled = Boolean(
    db && userId && !userId.startsWith('demo-') && role === 'admin' && claimId,
  );
  const [reloadTick, setReloadTick] = useState(0);
  const currentKey = enabled
    ? `${userId}:${claimId}:${version}:${reloadTick}`
    : '';
  const [remote, setRemote] = useState<{
    key: string;
    claim: ServiceClaim | null;
    service: PublishedService | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!enabled || !db || !claimId) return;
    let active = true;
    fetchServiceClaim(db, claimId)
      .then(async (claim) => {
        if (!claim) {
          return {
            claim: null,
            service: null,
          };
        }
        const service = await fetchAdminService(db!, claim.providerId).catch(
          () => null,
        );
        return {
          claim,
          service,
        };
      })
      .then((result) => {
        if (active) setRemote({ key: currentKey, ...result, error: null });
      })
      .catch((cause) => {
        if (active)
          setRemote({
            key: currentKey,
            claim: null,
            service: null,
            error: firebaseMessage(cause),
          });
      });
    return () => {
      active = false;
    };
  }, [enabled, claimId, currentKey]);

  const retry = useCallback(() => setReloadTick((n) => n + 1), []);

  if (!db) {
    const safeServices = services ?? [];
    const mockClaim = claims?.find((item) => item.id === claimId) ?? null;
    const mockService = mockClaim
      ? (safeServices.find((item) => item.id === mockClaim.providerId) ?? null)
      : null;
    return {
      claim: mockClaim,
      service: mockService,
      loading: false,
      error: null,
      retry,
    };
  }

  return {
    claim: remote?.key === currentKey ? remote.claim : null,
    service: remote?.key === currentKey ? remote.service : null,
    loading: enabled && remote?.key !== currentKey,
    error: remote?.key === currentKey ? remote.error : null,
    retry,
  };
}
