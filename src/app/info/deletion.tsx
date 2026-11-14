import { router } from 'expo-router';
import { useAuth } from '../../features/auth/AuthProvider';
import { Text } from 'react-native';
import {
  ProviderAction,
  ProviderPage,
  useProviderStyles,
} from '../../features/provider/ProviderPage';
import { useSupportActions } from '../../features/support/useSupportActions';
import { supportConfig } from '../../features/support/config';
export default function DeletionScreen() {
  const s = useProviderStyles();
  const actions = useSupportActions();
  const { user, initializing } = useAuth();
  return (
    <ProviderPage title="حذف الحساب والبيانات">
      <Text style={s.heading}>طلب حذف الحساب</Text>
      <Text accessibilityRole="alert" style={s.notice}>
        حذف الحساب محتاج مراجعة وتحقق يدوي من الدعم. إرسال الطلب مش حذف فوري،
        وفتح البريد لوحده مش بيبعت الطلب.
      </Text>
      <Text style={s.body}>
        ابعت طلب الحذف من البريد اللي سجلت بيه حسابك إلى {supportConfig.email}.
        متبعتش كلمة المرور أو صور أوراقك الشخصية. الدعم هيتأكد إن الحساب حسابك
        قبل أي خطوة.
      </Text>
      <Text style={s.body}>
        الدعم هيراجع بيانات حسابك وخدماتك المنشورة وطلباتك. تسجيل الخروج أو مسح
        التطبيق مش بيحذف البيانات. مدة المراجعة والتنفيذ بيحددها الدعم بعد
        التحقق. لو عايز تعرف إيه اللي بيتحذف وإيه اللي بيتحفظ، اسأل الدعم.
      </Text>
      <ProviderAction
        title="فتح صفحة حذف الحساب والبيانات"
        onPress={actions.openDeletionPage}
      />
      <ProviderAction
        title={user ? 'طلب مراجعة حذف الحساب' : 'تسجيل الدخول لطلب الحذف'}
        disabled={initializing}
        onPress={() =>
          user
            ? router.push({
                pathname: '/support/new',
                params: { kind: 'deletion' },
              })
            : router.push({
                pathname: '/provider/sign-in',
                params: { next: 'deletion' },
              })
        }
      />
      {user && !initializing ? (
        <ProviderAction
          title="طلب حذف الحساب بالبريد"
          secondary
          onPress={actions.requestDeletion}
        />
      ) : null}
      <ProviderAction
        title="تواصل مع الدعم"
        secondary
        onPress={actions.openEmail}
      />
    </ProviderPage>
  );
}
