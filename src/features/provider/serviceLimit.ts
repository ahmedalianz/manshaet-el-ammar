export const DEFAULT_SERVICE_LIMIT = 3;
export const SERVICE_LIMIT_MESSAGE =
  'وصلت للحد الأقصى للخدمات المنشورة أو قيد المراجعة. لو محتاج تضيف أكتر، تواصل مع الدعم.';
export function reserveService(
  quota: { serviceIds?: string[]; limit?: number } | undefined,
  providerId: string,
) {
  const serviceIds = quota?.serviceIds ?? [];
  if (serviceIds.includes(providerId)) return serviceIds;
  const limit = quota?.limit ?? DEFAULT_SERVICE_LIMIT;
  if (serviceIds.length >= limit) throw new Error(SERVICE_LIMIT_MESSAGE);
  return [...serviceIds, providerId];
}
