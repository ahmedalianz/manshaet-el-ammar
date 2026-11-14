import { expect, it } from '@jest/globals';
import {
  validateAvailability,
  validateWeeklyHours,
} from '../src/features/availability/validation';
import {
  toStoredValues,
  fromStoredValues,
} from '../src/features/provider/firebaseMapping';
import { changedFields } from '../src/features/provider/changedFields';
import { confirmationDue } from '../src/features/provider/confirmation';
const period = (start: string, end: string, overnight = false) => ({
  start,
  end,
  overnight,
});
it('requires explicit modes only at submission and coverage for travelling services', () => {
  expect(validateAvailability({}, false)).toEqual({});
  expect(validateAvailability({}, true)).toHaveProperty('serviceMode');
  expect(validateAvailability({ serviceMode: 'mobile' }, true)).toHaveProperty(
    'coverageAreas',
  );
  expect(
    validateAvailability(
      { serviceMode: 'mobile', coverageAreas: ['all'] },
      true,
    ),
  ).toEqual({});
  expect(
    validateAvailability(
      { serviceMode: 'both', coverageAreas: ['all', 'وسط البلد'] },
      true,
    ),
  ).toHaveProperty('coverageAreas');
});
it('rejects overlapping periods, including adjacent days and the weekly boundary', () => {
  expect(
    validateWeeklyHours({
      sat: {
        status: 'open',
        periods: [period('09:00', '12:00'), period('11:00', '14:00')],
      },
    }),
  ).toBeTruthy();
  expect(
    validateWeeklyHours({
      sat: { status: 'open', periods: [period('22:00', '02:00', true)] },
      sun: { status: 'open', periods: [period('01:00', '04:00')] },
    }),
  ).toBeTruthy();
  expect(
    validateWeeklyHours({
      fri: { status: 'open', periods: [period('22:00', '02:00', true)] },
      sat: { status: 'allDay' },
    }),
  ).toBeTruthy();
  expect(
    validateWeeklyHours({
      sat: { status: 'open', periods: [period('22:00', '02:00', true)] },
      sun: { status: 'appointment' },
    }),
  ).toBeUndefined();
});
it('maps mobile coverage without requiring a private home address, and reads legacy fields', () => {
  const values = {
    name: 'أحمد',
    categoryId: 'plumbing',
    serviceTitle: 'سباك',
    description: '',
    phone: '01012345678',

    address: '',
    serviceMode: 'mobile' as const,
    coverageAreas: ['all'],
    weeklyHours: { sat: { status: 'closed' as const } },
  };
  expect(fromStoredValues(toStoredValues(values))).toEqual(values);
  expect(
    changedFields(
      { ...values, weeklyHours: { sat: { status: 'closed' } } },
      { ...values, weeklyHours: { sat: { status: 'allDay' } } },
    ),
  ).toContain('weeklyHours');
  const { serviceMode, coverageAreas, weeklyHours, ...legacy } = values;
  expect(
    fromStoredValues(toStoredValues({ ...legacy, address: 'عنوان' })),
  ).not.toHaveProperty('serviceMode');
});
it('reminds at 90 days, never implies automatic unpublishing', () => {
  const now = Date.parse('2026-11-13T00:00:00Z');
  expect(confirmationDue(undefined, now)).toBe(true);
  expect(
    confirmationDue(new Date(now - 89 * 86400000).toISOString(), now),
  ).toBe(false);
  expect(
    confirmationDue(new Date(now - 90 * 86400000).toISOString(), now),
  ).toBe(true);
});
