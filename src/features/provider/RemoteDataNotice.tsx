import { Text, View } from 'react-native';
import { useProviderState } from './ProviderContext';
import { ProviderAction, useProviderStyles } from './ProviderPage';
import { LoadingState } from '../../components/ui/LoadingState';
export function RemoteDataNotice({
  privateData = false,
}: {
  privateData?: boolean;
}) {
  const state = useProviderState();
  const s = useProviderStyles();
  const cachedAt = !privateData
    ? (state.publicProviders?.find((item) => item.cachedAt)?.cachedAt ??
      state.categories?.find((item) => item.cachedAt)?.cachedAt)
    : undefined;
  if (cachedAt)
    return (
      <View style={s.card}>
        <Text accessibilityRole="alert" style={s.notice}>
          بيانات محفوظة على الجهاز — آخر تحديث:{' '}
          {new Date(cachedAt).toLocaleString('ar-EG')}. المتاح هنا هو اللي
          اتحمّل قبل كده، وممكن يكون اتغيّر.
        </Text>
        <ProviderAction
          secondary
          title="حدّث البيانات"
          onPress={state.refresh}
        />
      </View>
    );
  if (state.configured === false)
    return (
      <Text accessibilityRole="alert" style={s.notice}>
        لسه بنجهّز الدليل. الحسابات والخدمات هتشتغل بعد ما نكمّل الإعدادات.
      </Text>
    );
  if (
    privateData
      ? state.initializing || state.privateLoading
      : state.publicLoading
  )
    return <LoadingState />;
  const error = privateData ? state.privateError : state.publicError;
  if (error)
    return (
      <View style={s.card}>
        <Text accessibilityRole="alert" style={s.body}>
          {error}
        </Text>
        <Text style={s.notice}>
          البيانات اللي قدامك هي آخر نسخة اتحمّلت، وممكن تكون اتغيّرت. لو إرسال
          التعديلات متأكدش، متعتبرهاش طلب اتبعت. جرّب تاني لما الاتصال يرجع.
        </Text>
        <ProviderAction title="جرّب تاني" onPress={state.refresh} />
      </View>
    );
  return null;
}
