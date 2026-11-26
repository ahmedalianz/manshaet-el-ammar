import { validateAvailability } from '../availability/validation';
import type { ServiceValues } from './types';

export function normalizeMobile(value: string): string {
  let normalized = value
    .replace(/[٠-٩۰-۹]/g, (digit) => {
      const code = digit.charCodeAt(0);
      return String(code >= 0x6f0 ? code - 0x6f0 : code - 0x660);
    })
    .replace(/[\s()-]/g, '');
  if (normalized.startsWith('+20')) normalized = `0${normalized.slice(3)}`;
  else if (normalized.startsWith('0020'))
    normalized = `0${normalized.slice(4)}`;
  else if (normalized.startsWith('20')) normalized = `0${normalized.slice(2)}`;
  return normalized;
}

export function validateMobile(value: string): string | undefined {
  return /^01[0125]\d{8}$/.test(normalizeMobile(value))
    ? undefined
    : 'اكتب رقم موبايل مصري صحيح من ١١ رقم.';
}

// Egyptian geographic numbers, including the leading domestic zero.
export function validatePhone(value: string): string | undefined {
  const number = normalizeMobile(value);
  return !validateMobile(number) ||
    /^0(?:13[23]\d{6}|(?:15|57)\d{6,7}|(?:2\d|3|4[05-8]|5[05]|6[24-689]|8[2468]|9[235-7])\d{7})$/.test(
      number,
    )
    ? undefined
    : 'اكتب رقم موبايل أو أرضي مصري صحيح بكود المحافظة.';
}

export type FormErrors = Partial<
  Record<keyof ServiceValues | 'consent', string>
>;
export function validateService(
  values: ServiceValues,
  step: 1 | 2,
  consent: boolean,
): FormErrors {
  const errors: FormErrors = {};
  if (step === 1) {
    for (const field of ['name', 'categoryId', 'serviceTitle'] as const) {
      if (!values[field].trim()) errors[field] = 'كمّل الخانة دي.';
    }
  } else {
    if (validatePhone(values.phone)) errors.phone = validatePhone(values.phone);
    if (
      values.whatsapp?.trim() &&
      !/^01[0125]\d{8}$/.test(normalizeMobile(values.whatsapp))
    )
      errors.whatsapp = 'اكتب رقم واتساب مصري صحيح.';
    Object.assign(errors, validateAvailability(values, true));
    if (values.serviceMode !== 'mobile' && !values.address.trim())
      errors.address = 'اكتب العنوان أو علامة مميزة.';
    if (!consent) errors.consent = 'لازم توافق على عرض البيانات قبل الإرسال.';
  }
  return errors;
}
