import { onIdTokenChanged } from '@firebase/auth';
import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { auth } from '../../lib/firebase/auth';
import { getPhotoApiUrl } from './api';

export function PrivatePhotoPreview({ candidateId }: { candidateId: string }) {
  const [token, setToken] = useState<string>();
  const apiUrl = getPhotoApiUrl();
  useEffect(() => {
    let active = true;
    if (!auth) return;
    let revision = 0;
    const unsubscribe = onIdTokenChanged(auth, (user) => {
      const currentRevision = ++revision;
      setToken(undefined);
      if (user)
        void user
          .getIdToken()
          .then((value) => {
            if (active && revision === currentRevision) setToken(value);
          })
          .catch(() => {});
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [candidateId]);
  if (!token || !apiUrl) return null;
  return (
    <Image
      source={{
        uri: `${apiUrl}/v1/photos/candidates/${encodeURIComponent(candidateId)}/preview`,
        headers: { Authorization: `Bearer ${token}` },
      }}
      cachePolicy="none"
      style={{ width: 72, height: 72, borderRadius: 14 }}
      contentFit="cover"
      accessibilityLabel="صورة خاصة قيد المراجعة"
    />
  );
}
