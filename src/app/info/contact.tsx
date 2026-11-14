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
export default function ContactScreen() {
  const s = useProviderStyles();
  const { user } = useAuth();
  const actions = useSupportActions();
  return (
    <ProviderPage title="المساعدة والدعم">
      <Text style={s.heading}>تواصل مع الدعم</Text>
      <Text selectable style={s.body}>
        {supportConfig.email}
      </Text>
      <Text style={s.body}>
        محتاج مساعدة، عندك اقتراح، أو عايز تحذف حسابك وبياناتك؟ ابعتلنا. متبعتش
        كلمة المرور أو أي بيانات حساسة مش محتاجينها.
      </Text>
      <ProviderAction
        title={user ? 'إرسال طلب دعم ومتابعته' : 'تسجيل الدخول لطلب دعم'}
        onPress={() =>
          user
            ? router.push('/support/new')
            : router.push({
                pathname: '/provider/sign-in',
                params: { next: 'support' },
              })
        }
      />
      <ProviderAction
        title="فتح البريد الإلكتروني"
        onPress={actions.openEmail}
      />
    </ProviderPage>
  );
}
