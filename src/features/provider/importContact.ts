import { normalizeMobile, validatePhone } from './validation';

export async function pickServiceContact() {
  // Load only when the native import action is used.
  const { Contact, ContactField, requestPermissionsAsync } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('expo-contacts') as typeof import('expo-contacts');
  const permission = await requestPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      'اسمح بالوصول لجهات الاتصال من إعدادات التطبيق، أو اكتب البيانات يدويًا.',
    );
  const contact = await Contact.presentPicker();
  if (!contact) return null;
  const details = await contact.getDetails([
    ContactField.FULL_NAME,
    ContactField.PHONES,
  ]);
  const phones = [
    ...new Set(
      (details.phones ?? [])
        .map((phone) => normalizeMobile(phone.number ?? ''))
        .filter((phone) => !validatePhone(phone)),
    ),
  ];
  if (!phones.length)
    throw new Error('جهة الاتصال دي مفيهاش رقم موبايل أو أرضي مصري صحيح.');
  return { name: details.fullName?.trim() ?? '', phones };
}
