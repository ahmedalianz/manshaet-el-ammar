import { normalizeMobile } from '../provider/validation';
import type { ServiceProvider } from './types';

export function normalizeContactNumber(
  value: string | undefined,
): string | null {
  if (!value) return null;
  const local = normalizeMobile(value);
  return /^01[0125]\d{8}$/.test(local) ? `+20${local.slice(1)}` : null;
}
export function contactUrl(
  value: string,
  action: 'call' | 'whatsapp',
): string | null {
  const number = normalizeContactNumber(value);
  return number
    ? action === 'call'
      ? `tel:${number}`
      : `https://wa.me/${number.slice(1)}`
    : null;
}
export function providerContactNumber(
  provider: ServiceProvider | null | undefined,
  action: 'call' | 'whatsapp' = 'call',
): string | null {
  if (
    provider?.dataSource !== 'firestore' ||
    provider.status !== 'approved' ||
    provider.publicationStatus !== 'published'
  )
    return null;
  return normalizeContactNumber(
    action === 'whatsapp' ? provider.whatsapp : provider.phone,
  );
}
type Result = { ok: boolean; message?: string; copyNumber?: string };
type LinkingApi = {
  openURL: (url: string) => Promise<unknown>;
  canOpenURL?: (url: string) => Promise<boolean>;
};
export async function launchContactUrl(
  url: string,
  linking: LinkingApi,
): Promise<Result> {
  if (!/^(tel:\+201[0125]\d{8}|https:\/\/wa\.me\/201[0125]\d{8})$/.test(url))
    return { ok: false, message: 'رقم التواصل غير صحيح.' };
  try {
    if (linking.canOpenURL && !(await linking.canOpenURL(url)))
      return { ok: false, message: 'التواصل مش متاح على الجهاز ده.' };
    await linking.openURL(url);
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: 'مش قادرين نفتح تطبيق الاتصال. تقدر تنسخ الرقم وتتصل بنفسك.',
    };
  }
}
export async function openProviderContact(
  provider?: ServiceProvider | null,
  action: 'call' | 'whatsapp' = 'call',
  linking?: LinkingApi,
): Promise<Result> {
  const number = providerContactNumber(provider, action);
  if (!number || !linking)
    return {
      ok: false,
      message:
        action === 'call'
          ? 'رقم الموبايل مش متاح دلوقتي'
          : 'رقم واتساب مش متاح دلوقتي',
    };
  const result = await launchContactUrl(contactUrl(number, action)!, linking);
  return result.ok
    ? result
    : {
        ...result,
        message:
          action === 'whatsapp'
            ? 'مش قادرين نفتح واتساب. تقدر تنسخ الرقم وتتواصل بنفسك.'
            : result.message,
        copyNumber: number,
      };
}
export async function copyProviderNumber(
  provider: ServiceProvider | null | undefined,
  clipboard: { setStringAsync: (text: string) => Promise<boolean> },
  action: 'call' | 'whatsapp' = 'call',
): Promise<Result> {
  const number = providerContactNumber(provider, action);
  if (!number) return { ok: false, message: 'رقم التواصل مش متاح دلوقتي' };
  try {
    if (await clipboard.setStringAsync(number))
      return { ok: true, message: 'تم نسخ الرقم' };
  } catch {
    /* Native clipboard failures use the same user-facing message. */
  }
  return { ok: false, message: 'مش قادرين ننسخ الرقم. جرّب تاني.' };
}
