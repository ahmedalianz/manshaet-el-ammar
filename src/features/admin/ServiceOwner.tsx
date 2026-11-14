import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { db } from '../../lib/firebase/firestore';
import { fetchProfile } from '../provider/firebaseRepository';
import { ProviderAction, useProviderStyles } from '../provider/ProviderPage';

export function ServiceOwner({ ownerId }: { ownerId: string }) {
  const styles = useProviderStyles();
  const auth = useAuth();
  const profile = useQuery({
    queryKey: ['private', auth.user?.uid, 'service-owner', ownerId],
    queryFn: () => fetchProfile(db!, ownerId),
    enabled: Boolean(db && auth.isAdmin && !auth.initializing && ownerId),
  });
  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>
        الحساب اللي أضاف الخدمة
      </Text>
      <Text style={styles.body}>
        {profile.isError
          ? 'مش قادرين نحمّل اسم صاحب الحساب.'
          : profile.isPending && profile.fetchStatus === 'fetching'
            ? 'بنحمّل اسم صاحب الحساب…'
            : (profile.data?.name ?? 'اسم الحساب غير متاح')}
      </Text>
      {profile.isError ? (
        <ProviderAction
          title="إعادة تحميل صاحب الحساب"
          secondary
          onPress={() => {
            void profile.refetch();
          }}
        />
      ) : null}
    </View>
  );
}
