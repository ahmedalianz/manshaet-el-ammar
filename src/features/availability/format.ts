import type { Availability } from './types';
import { dayKeys } from './validation';
const days = [
  'السبت',
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
];
export function formatAvailabilityField(
  field: keyof Availability,
  value: Availability,
): string {
  if (field === 'serviceMode')
    return value.serviceMode
      ? {
          fixed: 'في مكان ثابت',
          mobile: 'بروح للعميل',
          both: 'مكان ثابت وبروح للعميل',
        }[value.serviceMode]
      : 'غير محدد';
  if (field === 'coverageAreas')
    return (
      value.coverageAreas
        ?.map((area) => (area === 'all' ? 'كل منشأة العمار' : area))
        .join('، ') || 'غير محدد'
    );
  return (
    dayKeys
      .flatMap((key, index) => {
        const day = value.weeklyHours?.[key];
        if (!day || day.status === 'unspecified') return [];
        return [
          `${days[index]}: ${day.status === 'open' ? day.periods?.map((period) => `${formatTime(period.start)} – ${formatTime(period.end)}${period.overnight ? ' (اليوم التالي)' : ''}`).join('، ') : { closed: 'مغلق', appointment: 'بموعد مسبق', allDay: 'طوال اليوم' }[day.status]}`,
        ];
      })
      .join('\n') || 'غير محدد'
  );
}

export function clock12(value: string): string {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return value;
  return `${String(Number(value.slice(0, 2)) % 12 || 12).padStart(2, '0')}${value.slice(2)}`;
}
export function clock24(value: string, pm: boolean): string {
  const text = value.replace(/[٠-٩۰-۹]/g, (digit) =>
    String(
      digit.charCodeAt(0) - (digit.charCodeAt(0) >= 0x6f0 ? 0x6f0 : 0x660),
    ),
  );
  if (!/^(?:0?[1-9]|1[0-2]):[0-5]\d$/.test(text)) return '';
  return `${String((Number(text.split(':')[0]) % 12) + (pm ? 12 : 0)).padStart(2, '0')}:${text.split(':')[1]}`;
}
export function formatTime(value: string): string {
  return `${clock12(value)} ${Number(value.slice(0, 2)) >= 12 ? 'مساءً' : 'صباحًا'}`;
}
