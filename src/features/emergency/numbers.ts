import type { IconName } from '../discovery/types';

// Source pages were checked on this date. Never replace this with the current
// date at render time; change it only after reviewing the linked sources again.
export const emergencyVerification = {
  checkedAt: '2026-11-18',
  sourceUrl: 'https://www.gov.uk/foreign-travel-advice/egypt/getting-help',
  corroboratingUrl: 'https://www.orange.eg/ar/help/emergency-numbers',
} as const;

export const emergencyNumbers = [
  { label: 'الإسعاف', number: '123', icon: 'ambulance' },
  { label: 'النجدة', number: '122', icon: 'shield-outline' },
  { label: 'المطافي', number: '180', icon: 'fire-truck' },
] as const;

export type EmergencySectionId =
  'urgent' | 'toukh' | 'utilities' | 'roads-support';

export type EmergencyItem = {
  id: string;
  label: string;
  number: string;
  secondaryNumber?: string;
  description: string;
  icon: IconName;
};

export type EmergencySection = {
  id: EmergencySectionId;
  title: string;
  subtitle: string;
  items: readonly EmergencyItem[];
};

export const emergencySections: readonly EmergencySection[] = [
  {
    id: 'urgent',
    title: 'للحالات العاجلة',
    subtitle: 'الإسعاف والشرطة والمطافي والطوارئ الطبية',
    items: [
      {
        id: 'ambulance',
        label: 'الإسعاف',
        number: '123',
        icon: 'ambulance',
        description: 'للحالات الطبية الطارئة ونقل المصابين',
      },
      {
        id: 'police',
        label: 'شرطة النجدة',
        number: '122',
        icon: 'shield-outline',
        description: 'لطلب مساعدة الشرطة في الحالات العاجلة',
      },
      {
        id: 'fire',
        label: 'المطافي والحماية المدنية',
        number: '180',
        icon: 'fire-truck',
        description: 'للإبلاغ عن حريق أو طلب الإنقاذ',
      },
      {
        id: 'icu',
        label: 'الرعاية الحرجة والطوارئ الطبية',
        number: '137',
        icon: 'hospital-box-outline',
        description: 'للاستفسار عن أسرّة الرعاية المركزة وحضّانات الأطفال',
      },
    ],
  },
  {
    id: 'toukh',
    title: 'جهات قريبة منك',
    subtitle: 'خدمات طبية وأمنية ومرافق في طوخ والقليوبية',
    items: [
      {
        id: 'toukh-hospital',
        label: 'مستشفى طوخ المركزي (الطوارئ)',
        number: '0132460004',
        secondaryNumber: '0132460131',
        icon: 'hospital-building',
        description: 'للتواصل مع الاستقبال والطوارئ في مستشفى طوخ',
      },
      {
        id: 'toukh-police',
        label: 'مركز شرطة طوخ',
        number: '0132460003',
        secondaryNumber: '0132464302',
        icon: 'shield-account-outline',
        description: 'شارع البطل أحمد عبد العزيز، طوخ',
      },
      {
        id: 'toukh-electricity',
        label: 'إدارة كهرباء طوخ',
        number: '0132465116',
        icon: 'flash-outline',
        description:
          'للإبلاغ عن انقطاع الكهرباء أو الأعطال في طوخ والقرى التابعة لها',
      },
      {
        id: 'qalyubia-ops',
        label: 'غرفة عمليات محافظة القليوبية',
        number: '114',
        secondaryNumber: '0133222979',
        icon: 'phone-alert-outline',
        description: 'للإبلاغ عن الحالات الطارئة داخل المحافظة',
      },
      {
        id: 'qalyubia-water',
        label: 'طوارئ مياه الشرب والصرف بالقليوبية',
        number: '01200288880',
        icon: 'water-pump',
        description: 'للإبلاغ عن أعطال المياه والصرف الصحي في القليوبية',
      },
    ],
  },
  {
    id: 'utilities',
    title: 'طوارئ المرافق العامة',
    subtitle: 'أعطال الكهرباء والغاز الطبيعي والمياه والصرف الصحي',
    items: [
      {
        id: 'electricity',
        label: 'طوارئ الكهرباء',
        number: '121',
        icon: 'lightning-bolt-outline',
        description: 'للإبلاغ عن أعطال الكهرباء وأعمدة الإنارة',
      },
      {
        id: 'gas',
        label: 'طوارئ الغاز الطبيعي',
        number: '129',
        icon: 'fire-alert',
        description: 'للإبلاغ عن تسرّب الغاز الطبيعي أو الأعطال',
      },
      {
        id: 'water',
        label: 'أعطال مياه الشرب',
        number: '125',
        icon: 'water-outline',
        description: 'للإبلاغ عن انقطاع المياه أو أعطال الشبكة',
      },
      {
        id: 'sewage',
        label: 'طوارئ الصرف الصحي',
        number: '175',
        icon: 'pipe-leak',
        description: 'للإبلاغ عن انسداد الصرف الصحي أو طفح المياه',
      },
    ],
  },
  {
    id: 'roads-support',
    title: 'مساعدة وبلاغات أخرى',
    subtitle: 'المرور والصحة وحماية الطفل والشكاوى الحكومية',
    items: [
      {
        id: 'traffic',
        label: 'شرطة المرور',
        number: '128',
        icon: 'traffic-light',
        description: 'للإبلاغ عن الحوادث ومشكلات المرور',
      },
      {
        id: 'highway-relief',
        label: 'إغاثة الطرق السريعة',
        number: '01221110000',
        icon: 'highway',
        description: 'لطلب المساعدة عند حدوث عطل على الطرق السريعة والرئيسية',
      },
      {
        id: 'moh-hotline',
        label: 'الخط الساخن لوزارة الصحة',
        number: '105',
        icon: 'medical-bag',
        description: 'للاستفسارات الصحية وتقديم الشكاوى الطبية',
      },
      {
        id: 'child-helpline',
        label: 'خط نجدة الطفل',
        number: '16000',
        icon: 'hand-heart-outline',
        description: 'للإبلاغ عن طفل معرّض للخطر وطلب المساعدة',
      },
      {
        id: 'complaints',
        label: 'منظومة الشكاوى الحكومية الموحدة',
        number: '16528',
        icon: 'bullhorn-outline',
        description: 'لتقديم شكوى عن جهة حكومية أو خدمة عامة',
      },
    ],
  },
];
