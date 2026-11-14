import { Text } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useProviderState } from '../../../features/provider/ProviderContext';
import {
  ProviderPage,
  useProviderStyles,
} from '../../../features/provider/ProviderPage';
import { ServiceForm } from '../../../features/provider/ServiceForm';
export default function DraftScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useProviderState(),
    s = useProviderStyles();
  if (!state.userId && !state.initializing)
    return <Redirect href="/provider/sign-in?next=drafts" />;
  if (!state.userId)
    return (
      <ProviderPage title="المسودة">
        <Text style={s.body}>بنحمّل حسابك…</Text>
      </ProviderPage>
    );
  if (!id || !/^[A-Za-z0-9_-]{1,128}$/.test(id))
    return (
      <ProviderPage title="المسودة">
        <Text style={s.body}>المسودة دي مش متاحة.</Text>
      </ProviderPage>
    );
  const listing =
    id === 'new' ? undefined : state.listings.find((item) => item.id === id);
  const offlineOnly = Boolean(
    state.privateLoading || state.privateError || (!listing && id !== 'new'),
  );
  if (listing?.status === 'pending' || listing?.pendingChanges)
    return (
      <Redirect href={{ pathname: '/provider/edit/[id]', params: { id } }} />
    );
  return (
    <ServiceForm
      key={`${state.userId}:${id}:${listing?.updatedAt ?? 'offline'}`}
      listing={listing}
      draftProviderId={id === 'new' ? undefined : id}
      offlineDraftOnly={offlineOnly}
      onRefreshDraft={state.refresh}
    />
  );
}
