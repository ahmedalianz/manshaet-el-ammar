import type { IconName, ServiceCategory } from '../types';

export const categories: ServiceCategory[] = [
  {
    id: 'plumbing',
    name: 'السباكة والمضخات',
    description: 'أدوات صحية، مضخات ري، وتصليح تركيبات منزلية',
    icon: 'pipe-wrench',
    group: 'trades',
    keywords: ['سباكة', 'سباك', 'مياه', 'صحي'],
  },
  {
    id: 'electricity',
    name: 'الكهرباء والطاقة',
    description: 'تأسيس وصيانة كهرباء المنازل ولوحات التوزيع',
    icon: 'lightning-bolt-outline',
    group: 'trades',
    keywords: ['كهرباء', 'كهربائي', 'طاقة'],
  },
  {
    id: 'clinics',
    name: 'الأطباء والعيادات',
    description: 'باطنة، أطفال، عظام، وأسنان واستشارات طبية عامة',
    icon: 'stethoscope',
    group: 'health',
    keywords: ['طبيب', 'دكتور', 'عيادة', 'صحة'],
  },
  {
    id: 'pharmacies',
    name: 'الصيدليات والعلاج',
    description: 'صيدليات القرية وأدوية ومستلزمات علاجية',
    icon: 'medical-bag',
    group: 'health',
    keywords: ['صيدلية', 'دواء', 'علاج'],
  },
  {
    id: 'carpentry',
    name: 'النجارة والأثاث والألوميتال',
    description: 'أبواب وشبابيك، أثاث ومطابخ، وأعمال الألوميتال وصيانة الأخشاب',
    icon: 'hammer-wrench',
    group: 'trades',
    keywords: [
      'نجار',
      'أثاث',
      'أبواب',
      'أخشاب',
      'ألوميتال',
      'الوميتال',
      'ألومنيوم',
      'شبابيك',
    ],
  },
  {
    id: 'shops',
    name: 'المحلات والبقالة',
    description: 'بقالة تموينية، خضار وفواكه، جزارة، وأعلاف زراعية',
    icon: 'storefront-outline',
    group: 'shops',
    keywords: ['محل', 'بقالة', 'تجارة', 'خضار'],
  },
  {
    id: 'transport',
    name: 'المواصلات ونقل البضائع',
    description: 'نقل محاصيل، سيارات ومشاوير، وتوصيل داخل القرية',
    icon: 'car-outline',
    group: 'trades',
    keywords: ['مواصلات', 'نقل', 'سيارة', 'توصيل'],
  },
  {
    id: 'construction',
    name: 'البناء والتشطيب',
    description: 'حدادة، محارة، دهانات، وتركيب سيراميك ورخام',
    icon: 'hammer-screwdriver',
    group: 'trades',
    keywords: ['بناء', 'تشطيب', 'حداد', 'دهان'],
  },
  {
    id: 'appliances',
    name: 'تصليح الأجهزة المنزلية',
    description: 'غسالات، ثلاجات، بوتاجازات، وشاشات وأجهزة منزلية',
    icon: 'washing-machine',
    group: 'trades',
    keywords: ['أجهزة', 'غسالة', 'ثلاجة', 'صيانة'],
  },
  {
    id: 'education',
    name: 'تعليم ودروس',
    description: 'مساعدة دراسية ودروس لأبناء البلد',
    icon: 'book-open-variant',
    group: 'community',
    keywords: ['تعليم', 'دروس', 'مدرس'],
  },
  {
    id: 'tailoring',
    name: 'الخياطة والتطريز',
    description: 'تفصيل وتعديل الملابس وأعمال الخياطة والتطريز',
    icon: 'content-cut',
    group: 'trades',
    keywords: ['خياطة', 'خياط', 'تفصيل', 'تطريز', 'ملابس'],
  },
  {
    id: 'laundry',
    name: 'مغسلة',
    description: 'غسيل وكي الملابس وتنظيف المفروشات',
    icon: 'tshirt-crew-outline',
    group: 'shops',
    keywords: ['مغسلة', 'غسيل', 'كي', 'ملابس', 'مفروشات', 'دراي كلين'],
  },
  {
    id: 'sewage-trucks',
    name: 'عربات الكسح',
    description: 'كسح وشفط البيارات وخزانات الصرف الصحي',
    icon: 'truck-outline',
    group: 'trades',
    keywords: ['كسح', 'عربات', 'عربيات', 'شفط', 'بيارات', 'صرف صحي'],
  },
  {
    id: 'other',
    name: 'خدمات تانية',
    description: 'أي خدمة تانية مش موجودة في الأقسام المتاحة',
    icon: 'dots-horizontal-circle-outline',
    group: 'community',
    keywords: [
      'خدمات تانية',
      'تانية',
      'ثانية',
      'أخرى',
      'خدمات أخرى',
      'متنوعة',
      'غير ذلك',
      'other',
    ],
  },
];

export const homeCategoryIds = [
  'electricity',
  'plumbing',
  'pharmacies',
  'clinics',
  'transport',
  'shops',
  'education',
  'carpentry',
];

/** Resolves a valid MaterialCommunityIcons name, falling back to the built-in category icon when remote/cached data carries a legacy or unknown icon name. */
export function resolveCategoryIcon(id: string, rawIcon: unknown): IconName {
  return (
    categories.find((category) => category.icon === rawIcon)?.icon ??
    categories.find((category) => category.id === id)?.icon ??
    'briefcase-outline'
  );
}
