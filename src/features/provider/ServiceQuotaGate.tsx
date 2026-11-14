import { useEffect, useState } from 'react';
import { readDraft } from '../local/drafts';
import { useQuery } from '@tanstack/react-query';
import { doc, getDocFromServer } from '@firebase/firestore';
import { Text } from 'react-native';
import type { ReactNode } from 'react';
import { db } from '../../lib/firebase/firestore';
import { readWithDeadline } from '../../lib/network';
import { LoadingState } from '../../components/ui/LoadingState';
import { useSupportActions } from '../support/useSupportActions';
import {
  ProviderAction,
  ProviderPage,
  useProviderStyles,
} from './ProviderPage';
import { DEFAULT_SERVICE_LIMIT, SERVICE_LIMIT_MESSAGE } from './serviceLimit';

export function ServiceQuotaGate({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const styles = useProviderStyles();
  const [hasDraft, setHasDraft] = useState(false);
  useEffect(() => {
    let active = true;
    void readDraft(userId, 'new')
      .then((draft) => {
        if (active) setHasDraft(Boolean(draft));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId]);
  const support = useSupportActions();
  const quota = useQuery({
    queryKey: ['private', userId, 'service-quota'],
    queryFn: async () => {
      const result = await readWithDeadline(
        getDocFromServer(doc(db!, 'serviceQuotas', userId)),
      );
      return result.exists() ? result.data() : { serviceIds: [] };
    },
    enabled: Boolean(db),
    staleTime: 0,
  });
  if (!db) return children;
  if (hasDraft && (quota.isPending || quota.isError)) return children;
  if (quota.isPending)
    return (
      <ProviderPage title="إضافة خدمة">
        <LoadingState />
      </ProviderPage>
    );
  if (quota.isError)
    return (
      <ProviderPage title="إضافة خدمة">
        <Text style={styles.body}>
          مش قادرين نعرف عدد خدماتك دلوقتي. جرّب تاني.
        </Text>
        <ProviderAction
          title="جرّب تاني"
          onPress={() => {
            void quota.refetch();
          }}
        />
      </ProviderPage>
    );
  const limit = quota.data.limit ?? DEFAULT_SERVICE_LIMIT;
  if (quota.data.serviceIds.length >= limit)
    return (
      <ProviderPage title="إضافة خدمة">
        <Text accessibilityRole="alert" style={styles.body}>
          {SERVICE_LIMIT_MESSAGE}
        </Text>
        <ProviderAction
          title="تواصل مع الدعم لإضافة خدمات أكتر"
          onPress={support.openEmail}
        />
      </ProviderPage>
    );
  return children;
}
