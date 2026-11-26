import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';
import { render, screen, fireEvent } from './helpers/render';
import { currentHours } from '../src/features/availability/currentHours';
import { ServiceWorkingHours } from '../src/features/availability/ServiceWorkingHours';
import type { WeeklyHours } from '../src/features/availability/types';
import { colors } from '../src/theme/colors';

const hours: WeeklyHours = {
  thu: {
    status: 'open',
    periods: [{ start: '13:00', end: '22:00', overnight: false }],
  },
  fri: { status: 'closed' },
};

it.each([
  ['2026-11-26T10:59:00Z', 'closed'],
  ['2026-11-26T11:00:00Z', 'open'],
  ['2026-11-26T19:59:00Z', 'open'],
  ['2026-11-26T20:00:00Z', 'closed'],
  ['2026-11-27T11:00:00Z', 'closed'],
  ['2026-11-28T11:00:00Z', 'closed'],
])('uses Cairo time and exact opening boundaries at %s', (date, expected) => {
  expect(currentHours(hours, new Date(date)).status).toBe(expected);
});

it('includes overnight hours from the previous day across the weekly boundary', () => {
  const overnight: WeeklyHours = {
    fri: {
      status: 'open',
      periods: [{ start: '22:00', end: '02:00', overnight: true }],
    },
    sat: { status: 'closed' },
  };
  expect(currentHours(overnight, new Date('2026-11-27T23:00:00Z'))).toEqual({
    today: 'sat',
    status: 'open',
  });
  expect(currentHours(overnight, new Date('2026-11-28T00:00:00Z')).status).toBe(
    'closed',
  );
});

it('respects Cairo daylight saving and distinguishes appointments and all-day opening', () => {
  const thursday = new Date('2026-06-04T10:00:00Z'); // 13:00 in Cairo.
  expect(currentHours(hours, thursday).status).toBe('open');
  expect(
    currentHours({ thu: { status: 'appointment' } }, thursday).status,
  ).toBe('appointment');
  expect(currentHours({ thu: { status: 'allDay' } }, thursday).status).toBe(
    'open',
  );
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-26T12:00:00Z'));
});
afterEach(() => {
  jest.useRealTimers();
});

it('renders seven days, marks today, distinguishes closed and unspecified days, and collapses', async () => {
  await render(<ServiceWorkingHours value={{ weeklyHours: hours }} />);
  const toggle = screen.getByRole('button', { name: 'مواعيد العمل' });
  expect(toggle.props.accessibilityState.expanded).toBe(true);
  expect(screen.getByText('مفتوح الآن')).toBeTruthy();
  expect(screen.getAllByTestId(/^working-hours-/)).toHaveLength(7);
  expect(screen.getByText('الخميس · اليوم')).toBeTruthy();
  expect(screen.getByText('01:00 مساءً – 10:00 مساءً')).toBeTruthy();
  expect(screen.getAllByText('مغلق')).toHaveLength(6);
  expect(screen.queryByText('غير محدد')).toBeNull();
  expect(
    StyleSheet.flatten(screen.getByTestId('working-hours-thu').props.style)
      .borderColor,
  ).toBe(colors.accent);
  await fireEvent.press(toggle);
  expect(screen.queryByTestId('working-hours-thu')).toBeNull();
});

it('shows both periods, overnight labels, and appointment-only days', async () => {
  await render(
    <ServiceWorkingHours
      value={{
        weeklyHours: {
          thu: {
            status: 'open',
            periods: [
              { start: '09:00', end: '12:00', overnight: false },
              { start: '22:00', end: '02:00', overnight: true },
            ],
          },
          fri: { status: 'appointment' },
        },
      }}
    />,
  );
  expect(screen.getByText('09:00 صباحًا – 12:00 مساءً')).toBeTruthy();
  expect(screen.getByText('10:00 مساءً – 02:00 صباحًا')).toBeTruthy();
  expect(screen.getByText('اليوم التالي')).toBeTruthy();
  expect(screen.getByText('بموعد مسبق')).toBeTruthy();
  expect(screen.getByText('مغلق الآن')).toBeTruthy();
});

it('keeps unspecified schedules neutral and shows the contact prompt on expansion', async () => {
  await render(<ServiceWorkingHours value={{}} />);
  const toggle = screen.getByRole('button', { name: 'مواعيد العمل' });
  expect(toggle.props.accessibilityState.expanded).toBe(false);
  expect(screen.queryByText('مفتوح الآن')).toBeNull();
  await fireEvent.press(toggle);
  expect(
    screen.getByText('المواعيد غير محددة — تواصل مع مقدم الخدمة للتأكيد.'),
  ).toBeTruthy();
});
