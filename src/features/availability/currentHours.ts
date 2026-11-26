import type { DayKey, WeeklyHours } from './types';

const cairoClock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Africa/Cairo',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const week: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const minutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

export function currentHours(hours: WeeklyHours | undefined, now = new Date()) {
  const parts = cairoClock.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  const today = part('weekday').toLowerCase() as DayKey;
  const minute = Number(part('hour')) * 60 + Number(part('minute'));
  const day = hours?.[today];
  const previous = hours?.[week[(week.indexOf(today) + 6) % 7]];
  const carriedOver =
    previous?.status === 'open' &&
    previous.periods?.some(
      (period) => period.overnight && minute < minutes(period.end),
    );
  const withinPeriod =
    day?.status === 'open' &&
    day.periods?.some(
      (period) =>
        minute >= minutes(period.start) &&
        (period.overnight || minute < minutes(period.end)),
    );
  const status =
    carriedOver || withinPeriod || day?.status === 'allDay'
      ? 'open'
      : day?.status === 'closed' ||
          (day?.status === 'open' && day.periods?.length)
        ? 'closed'
        : day?.status === 'appointment'
          ? 'appointment'
          : hours
            ? 'closed'
            : 'unknown';
  return { today, status } as const;
}
