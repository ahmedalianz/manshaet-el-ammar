import type { Availability, DayKey } from './types';
export const dayKeys: DayKey[] = [
  'sat',
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
];
const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const minutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
export function validateWeeklyHours(value: unknown): string | undefined {
  if (value === undefined) return;
  const invalid = 'راجع مواعيد العمل والفترات المتداخلة.';
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid;
  const intervals: [number, number][] = [];
  for (const [key, raw] of Object.entries(value)) {
    if (
      !dayKeys.includes(key as DayKey) ||
      !raw ||
      typeof raw !== 'object' ||
      Array.isArray(raw)
    )
      return invalid;
    const day = raw as { status?: unknown; periods?: unknown };
    if (
      Object.keys(raw).some((field) => !['status', 'periods'].includes(field))
    )
      return invalid;
    if (
      !['unspecified', 'closed', 'appointment', 'allDay', 'open'].includes(
        String(day.status),
      )
    )
      return invalid;
    const base = dayKeys.indexOf(key as DayKey) * 1440;
    if (day.status === 'allDay') intervals.push([base, base + 1440]);
    if (day.status !== 'open') {
      if (day.periods !== undefined) return invalid;
      continue;
    }
    if (
      !Array.isArray(day.periods) ||
      day.periods.length < 1 ||
      day.periods.length > 2
    )
      return invalid;
    for (const period of day.periods) {
      if (
        !period ||
        typeof period !== 'object' ||
        Array.isArray(period) ||
        Object.keys(period).sort().join(',') !== 'end,overnight,start'
      )
        return invalid;
      const { start, end, overnight } = period;
      if (
        typeof start !== 'string' ||
        typeof end !== 'string' ||
        !clock.test(start) ||
        !clock.test(end) ||
        typeof overnight !== 'boolean'
      )
        return invalid;
      const s = minutes(start),
        e = minutes(end);
      if ((!overnight && e <= s) || (overnight && e > s)) return invalid;
      intervals.push([base + s, base + e + (overnight ? 1440 : 0)]);
    }
  }
  const repeated = intervals
    .flatMap(
      ([start, end]) =>
        [
          [start, end],
          [start + 10080, end + 10080],
        ] as [number, number][],
    )
    .sort((a, b) => a[0] - b[0]);
  if (
    repeated.some(
      (item, index) => index > 0 && item[0] < repeated[index - 1][1],
    )
  )
    return invalid;
}
export function validateAvailability(value: Availability, requireMode = false) {
  const errors: Partial<Record<'serviceMode' | 'weeklyHours', string>> = {};
  if (
    (requireMode || value.serviceMode !== undefined) &&
    !['fixed', 'mobile', 'both'].includes(value.serviceMode ?? '')
  )
    errors.serviceMode = 'اختار طريقة تقديم الخدمة.';
  const hoursError = validateWeeklyHours(value.weeklyHours);
  if (hoursError) errors.weeklyHours = hoursError;
  return errors;
}
