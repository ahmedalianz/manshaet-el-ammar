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
        المفضلة بتتحفظ على جهازك بس. آخر مسودة غير مكتملة خاصة بكل حساب
        وبتتمسح عند تسجيل الخروج. نسخة الخدمات العامة المحفوظة للتصفح بدون اتصال
        ممكن تفضل على الجهاز لحد ٣٠ يوم.
      </Text>
      <Text style={s.body}>
        لو صاحب الخدمة أضاف صورة للمكان واتوافقت، الصورة بتتحفظ على خادم الصور
        (Cloudinary) وتظهر للناس، وبتتمسح من الخادم عند حذف الخدمة أو إلغاء
        نشرها أو حذف الحساب، بس النسخ اللي اتحمّلت أو اتحفظت على أجهزة
        المستخدمين مش بنقدر نسحبها فورًا.
      </Text>
      <Text style={s.body}>
        طلبات الدعم وبياناتها خاصة بصاحب الحساب وفريق المراجعة، وبنحفظ تفاصيل
        الطلب وحالته وآخر رد للمساعدة. تقدر تحذف حسابك وجميع خدماتك وبياناتك
        المرتبطة بيه فورًا وبشكل نهائي من «المزيد ← حذف الحساب والبيانات» بعد
        تأكيد هويتك.
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
