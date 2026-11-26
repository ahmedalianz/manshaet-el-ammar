import type { ServiceProvider } from '../discovery/types';
export function providerShareText(provider: ServiceProvider) {
  const location =
    provider.serviceMode === 'mobile' && !provider.address
      ? 'خدمة متنقلة'
      : provider.address;
  return [
    provider.name,
    provider.serviceTitle,
    `موبايل: ${provider.phone}`,
    provider.whatsapp ? `واتساب: ${provider.whatsapp}` : '',
    location,
    provider.cachedAt
      ? `بيانات محفوظة بتاريخ ${new Date(provider.cachedAt).toLocaleString('ar-EG')} — ممكن تكون اتغيّرت.`
      : '',
    'دليل خدمات منشأة العمار',
  ]
    .filter(Boolean)
    .join('\n');
}
