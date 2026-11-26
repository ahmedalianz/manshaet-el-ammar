import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase/firestore';
import { firebaseMessage } from '../auth/errors';
import { fetchAdminService } from '../provider/firebaseAdminRepository';
import { useProviderState } from '../provider/ProviderContext';
import type { PublishedService } from '../provider/types';

export function useAdminService(id: string | undefined) {
  const { role, userId, services, adminLoading } = useProviderState();
  const isAdmin = role === 'admin';
  const listed =
    isAdmin && id ? services?.find((item) => item.id === id) : undefined;
  const shouldFetch = Boolean(
    isAdmin && userId && id && db && !adminLoading && !listed,
  );
  const [attempt, setAttempt] = useState(0);
  const requestKey = shouldFetch && id ? `${id}:${attempt}` : '';
  const [fetched, setFetched] = useState<{
    key: string;
    service: PublishedService | null;
    error: string | null;
  }>({ key: '', service: null, error: null });

  useEffect(() => {
    if (!shouldFetch || !db || !id || !requestKey) return;
    let active = true;
    void fetchAdminService(db, id)
      .then((service) => {
        if (active) setFetched({ key: requestKey, service, error: null });
      })
      .catch((cause) => {
        if (active)
          setFetched({
            key: requestKey,
            service: null,
            error: firebaseMessage(cause),
          });
      });
    return () => {
      active = false;
    };
  }, [shouldFetch, id, requestKey]);

  if (!isAdmin)
    return {
      service: undefined,
      loading: false,
      error: null,
      retry: () => {},
    };
  if (listed)
    return {
      service: listed,
      loading: false,
      error: null,
      retry: () => {},
    };
  const resolved =
    fetched.key === requestKey ? (fetched.service ?? undefined) : undefined;
  const error = fetched.key === requestKey ? fetched.error : null;
  return {
    service: resolved,
    loading: Boolean(
      adminLoading || (shouldFetch && fetched.key !== requestKey),
    ),
    error,
    retry: () => setAttempt((count) => count + 1),
  };
}
