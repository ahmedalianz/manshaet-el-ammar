import Constants from 'expo-constants';
import { useSupportActions } from '../../features/support/useSupportActions';
import { supportConfig } from '../../features/support/config';
import {
  ProviderAction,
  ProviderPage,
  useProviderStyles,
} from '../../features/provider/ProviderPage';
import { Text } from 'react-native';
export default function AboutScreen() {
  const s = useProviderStyles();
  const actions = useSupportActions();
  return (
    <ProviderPage title="عن التطبيق والدليل">
      <Text style={s.heading}>منشأة العمار — بلدنا أقرب</Text>
      <Text style={s.body}>
        دليل مجاني بيساعد أهل منشأة العمار يلاقوا الخدمات وأصحاب المهن والمحلات
        في البلد.
      </Text>
      <Text style={s.body}>
        أصحاب الخدمات بيضيفوا بياناتهم، والطلبات بتتراجع قبل النشر. التواصل بيتم
        مباشرة خارج التطبيق ومن غير عمولات.
      </Text>
      <Text style={s.notice}>
        مراجعة البيانات مش شهادة خبرة أو ضمان لجودة الشغل. مفيش حجز أو دفع أو
        شات جوه التطبيق، والتطبيق مبادرة أهلية مش تابع لجهة حكومية.
      </Text>
      <Text style={s.body}>
        الإصدار {Constants.expoConfig?.version ?? 'غير متاح'}
      </Text>
      <Text selectable style={s.body}>
        {supportConfig.email}
      </Text>
      <ProviderAction title="تواصل مع الدعم" onPress={actions.openEmail} />
      <ProviderAction
        title="فتح سياسة الخصوصية"
        secondary
        onPress={actions.openPrivacy}
      />
    </ProviderPage>
  );
}
