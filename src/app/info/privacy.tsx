import { Text } from 'react-native';
import {
  ProviderAction,
  ProviderPage,
  useProviderStyles,
} from '../../features/provider/ProviderPage';
import { useSupportActions } from '../../features/support/useSupportActions';
export default function PrivacyScreen() {
  const s = useProviderStyles();
  const actions = useSupportActions();
  return (
    <ProviderPage title="سياسة الخصوصية والشروط">
      <Text style={s.heading}>خصوصيتك وبيانات الدليل</Text>
      <Text style={s.body}>
        بنستخدم Firebase لتسجيل الحسابات وحفظ بيانات الخدمات وطلباتها. بعد
        الموافقة على النشر، بيانات خدمتك زي الاسم ورقم الموبايل والعنوان بتظهر
        للناس. بريدك وبيانات حسابك الخاصة مش بتظهر في بطاقة الخدمة.
      </Text>
      <Text style={s.body}>
        الاتصال وواتساب بيفتحوا تطبيقات تانية على جهازك. مفيش شات أو حجز أو دفع
        جوه التطبيق.
      </Text>
      <Text style={s.body}>
        المحفوظات موجودة محليًا على جهازك. مسودات الخدمات خاصة بكل حساب وبتتمسح
        عند تسجيل الخروج. نسخة الخدمات العامة المحفوظة للتصفح بدون اتصال ممكن
        تفضل على الجهاز لحد ٣٠ يوم.
      </Text>
      <Text style={s.body}>
        طلبات الدعم والحذف وبياناتها خاصة بصاحب الحساب وفريق المراجعة. بنحفظ
        تفاصيل الطلب وحالته وآخر رد للمساعدة والتحقق. تنفيذ حذف الحساب والبيانات
        ومراجعة أي بيانات يلزم الاحتفاظ بها بيتم يدويًا بعد التحقق، وطلب الحذف
        وحده مش تنفيذ.
      </Text>
      <ProviderAction
        title="فتح سياسة الخصوصية"
        onPress={actions.openPrivacy}
      />
      <Text style={s.notice}>
        الرابط هيفتح سياسة الخصوصية في المتصفح. الكلام هنا ملخص لاستخدام
        بياناتك؛ ارجع للسياسة عشان تقرأ التفاصيل كاملة. الملخص مش بديل للسياسة
        أو شروط الاستخدام.
      </Text>
      <ProviderAction
        title="تواصل مع الدعم"
        secondary
        onPress={actions.openEmail}
      />
    </ProviderPage>
  );
}
