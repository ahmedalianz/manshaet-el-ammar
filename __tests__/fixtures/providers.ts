import type { ServiceProvider } from '../../src/features/discovery/types';

// All entries are fictional demo data. Their phone numbers are intentionally inert.
export const providers: ServiceProvider[] = [
  {
    id: 'provider-plumbing-1',
    name: 'أحمد محمود (بيانات تجريبية)',
    categoryId: 'plumbing',
    serviceTitle: 'سباك صحي وصيانة منزلية',
    description:
      'مثال تجريبي لخدمات السباكة المنزلية وصيانة الأدوات الصحية وتمديدات المياه.',
    phone: '010 0000 0001',
    whatsapp: '010 0000 0001',

    address: 'منشأة العمار — شارع المدارس (وسط البلد)',
    status: 'approved',
  },
  {
    id: 'provider-plumbing-2',
    name: 'حسن الجزار (بيانات تجريبية)',
    categoryId: 'plumbing',
    serviceTitle: 'تصليح مواسير المياه ومضخات الري',
    description:
      'مثال تجريبي لتصليح المواسير ومضخات المياه المنزلية والزراعية.',
    phone: '011 0000 0002',

    address: 'منشأة العمار — منطقة داير الناحية',
    status: 'approved',
  },
  {
    id: 'provider-plumbing-3',
    name: 'محمود سلامة (بيانات تجريبية)',
    categoryId: 'plumbing',
    serviceTitle: 'تأسيس وصيانة شبكات مياه وصرف',
    description: 'مثال تجريبي لخدمات تأسيس شبكات المياه والصرف داخل المنازل.',
    phone: '012 0000 0003',
    whatsapp: '012 0000 0003',

    address: 'منشأة العمار — مدخل طريق طوخ',
    status: 'approved',
  },
  {
    id: 'provider-electricity-1',
    name: 'محمد حسين (بيانات تجريبية)',
    categoryId: 'electricity',
    serviceTitle: 'فني كهرباء وتأسيس منازل',
    description: 'مثال تجريبي لأعمال الكهرباء المنزلية ولوحات التوزيع.',
    phone: '015 0000 0004',
    whatsapp: '015 0000 0004',

    address: 'منشأة العمار — غرب السكة',
    status: 'approved',
  },
  {
    id: 'provider-clinics-1',
    name: 'د. إبراهيم عبد السلام (بيانات تجريبية)',
    categoryId: 'clinics',
    serviceTitle: 'عيادة باطنة وأطفال',
    description: 'مدخل تجريبي لعرض عيادة محلية. لا يقدم التطبيق استشارة طبية.',
    phone: '010 0000 0005',

    address: 'منشأة العمار — بجوار محطة القطار',
    status: 'approved',
  },
  {
    id: 'provider-shops-1',
    name: 'سوق البلد (بيانات تجريبية)',
    categoryId: 'shops',
    serviceTitle: 'بقالة وخضار وفواكه',
    description: 'مثال تجريبي لمحل يبيع مستلزمات يومية وخضروات وفاكهة.',
    phone: '011 0000 0006',
    whatsapp: '011 0000 0006',

    address: 'منشأة العمار — السوق الرئيسي',
    status: 'approved',
  },
];
