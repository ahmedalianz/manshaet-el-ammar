import {
  SharedHoursEditor,
  needsAdvancedHours,
} from '../src/features/availability/SharedHoursEditor';
import { afterEach, expect, it, jest } from '@jest/globals';
import { Platform } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { render, screen, fireEvent } from './helpers/render';
import { AvailabilityFields } from '../src/features/availability/AvailabilityFields';
import { AvailabilityDetails } from '../src/features/availability/AvailabilityDetails';
import { TimeField } from '../src/features/availability/TimeField';
import { clock24, formatTime } from '../src/features/availability/format';
import type { Availability } from '../src/features/availability/types';

afterEach(() => {
  jest.restoreAllMocks();
});

it('converts noon, midnight, Arabic digits and rejects invalid 12-hour input', () => {
  expect(clock24('12:00', false)).toBe('00:00');
  expect(clock24('12:00', true)).toBe('12:00');
  expect(clock24('٠٥:٣٠', true)).toBe('17:30');
  expect(clock24('13:00', true)).toBe('');
  expect(formatTime('00:00')).toBe('12:00 صباحًا');
  expect(formatTime('17:30')).toBe('05:30 مساءً');
});
it('keeps optional form hours collapsed and retains times after toggling', async () => {
  function Form() {
    const [value, setValue] = useState<Availability>({ serviceMode: 'fixed' });
    return (
      <AvailabilityFields
        value={value}
        onChange={setValue}
        disabled={false}
        errors={{}}
      />
    );
  }
  await render(<Form />);
  const toggle = () =>
    screen.getByRole('button', { name: 'مواعيد العمل (اختياري)' });
  expect(
    screen.getByRole('button', {
      name: 'مواعيد العمل (اختياري)',
      expanded: false,
    }),
  ).toBeTruthy();
  expect(screen.queryByText('السبت')).toBeNull();
  await fireEvent.press(toggle());
  await fireEvent.press(
    screen.getByRole('button', { name: 'إعدادات متقدمة لكل يوم' }),
  );
  expect(
    screen.queryByRole('button', { name: 'السبت — فترات محددة' }),
  ).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'اختيار السبت' }));
  expect(
    screen.getByRole('button', { name: 'السبت — الفترة 1 — إلى' }).props
      .accessibilityValue.text,
  ).toBe('05:00 مساءً');
  await fireEvent.press(toggle());
  await fireEvent.press(toggle());
  expect(
    screen.getByRole('button', { name: 'السبت — الفترة 1 — إلى' }).props
      .accessibilityValue.text,
  ).toBe('05:00 مساءً');
});
it('uses a native clock picker without editable time text and commits only on confirmation', async () => {
  const change = jest.fn();
  await render(
    <TimeField label="إلى" value="17:00" disabled={false} onChange={change} />,
  );
  expect(screen.queryByDisplayValue('05:00')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'إلى' }));
  await fireEvent(
    screen.getByTestId('time-picker'),
    'valueChange',
    {},
    new Date(2000, 0, 15, 18, 30),
  );
  expect(change).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'اختيار الوقت' }));
  expect(change).toHaveBeenLastCalledWith('18:30');
  await fireEvent.press(screen.getByRole('button', { name: 'إلى' }));
  await fireEvent(
    screen.getByTestId('time-picker'),
    'valueChange',
    {},
    new Date(2000, 0, 15, 0, 0),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'إلغاء' }));
  expect(change).toHaveBeenCalledTimes(1);
});
it('uses Android clock mode and stores local 24-hour time', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const change = jest.fn();
  await render(
    <TimeField label="من" value="09:00" disabled={false} onChange={change} />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'من' }));
  const options = jest.mocked(DateTimePickerAndroid.open).mock.calls.at(-1)![0];
  expect(options).toEqual(
    expect.objectContaining({
      mode: 'time',
      display: 'clock',
      is24Hour: false,
    }),
  );
  options.onValueChange!(
    { nativeEvent: { timestamp: 0, utcOffset: 0 } },
    new Date(2000, 0, 15, 0, 5),
  );
  expect(change).toHaveBeenCalledWith('00:05');
});
it('reveals public hours only when expanded', async () => {
  await render(
    <AvailabilityDetails
      value={{
        serviceMode: 'fixed',
        weeklyHours: {
          sat: {
            status: 'open',
            periods: [{ start: '09:00', end: '17:00', overnight: false }],
          },
        },
      }}
    />,
  );
  expect(screen.queryByText(/09:00/)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'مواعيد العمل' }));
  expect(screen.getByText('السبت: 09:00 صباحًا – 05:00 مساءً')).toBeTruthy();
});

it('applies shared hours to selected days only after confirming replacement', async () => {
  const change = jest.fn();
  const value: Availability = {
    serviceMode: 'fixed',
    weeklyHours: {
      sat: {
        status: 'open',
        periods: [{ start: '10:00', end: '19:00', overnight: false }],
      },
      sun: { status: 'closed' },
    },
  };
  await render(
    <SharedHoursEditor value={value} onChange={change} disabled={false} />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'كل الأيام' }));
  await fireEvent.press(screen.getByRole('button', { name: 'تطبيق المواعيد' }));
  expect(change).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole('button', { name: 'الاحتفاظ بالمواعيد الحالية' }),
  );
  expect(change).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'كل الأيام' }));
  await fireEvent.press(screen.getByRole('button', { name: 'تطبيق المواعيد' }));
  await fireEvent.press(
    screen.getByRole('button', { name: 'تأكيد تغيير المواعيد' }),
  );
  expect(change).toHaveBeenCalledWith(
    expect.objectContaining({
      weeklyHours: expect.objectContaining({
        sun: value.weeklyHours!.sat,
        fri: value.weeklyHours!.sat,
      }),
    }),
  );
});

it('keeps complex and overnight schedules in advanced mode and confirms clearing', async () => {
  const value: Availability = {
    weeklyHours: {
      sat: {
        status: 'open',
        periods: [{ start: '22:00', end: '02:00', overnight: true }],
      },
    },
  };
  expect(needsAdvancedHours(value.weeklyHours)).toBe(true);
  const change = jest.fn();
  await render(
    <AvailabilityFields
      value={value}
      onChange={change}
      disabled={false}
      errors={{}}
    />,
  );
  expect(screen.getByLabelText('السبت — الفترة 1 — من')).toBeTruthy();
  await fireEvent.press(
    screen.getByRole('button', { name: 'مسح مواعيد العمل' }),
  );
  expect(change).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole('button', { name: 'تأكيد مسح المواعيد' }),
  );
  expect(change).toHaveBeenCalledWith({ ...value, weeklyHours: undefined });
});

it('switches to a travelling service without adding coverage data', async () => {
  const change = jest.fn();
  await render(
    <AvailabilityFields
      value={{ serviceMode: 'fixed' }}
      onChange={change}
      disabled={false}
      errors={{}}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'بروح للعميل' }));
  expect(change).toHaveBeenCalledWith({ serviceMode: 'mobile' });
});

it('asks for specific working days before showing their time fields', async () => {
  function Form() {
    const [value, setValue] = useState<Availability>({});
    return (
      <AvailabilityFields
        section="hours"
        value={value}
        onChange={setValue}
        disabled={false}
        errors={{}}
      />
    );
  }
  await render(<Form />);
  await fireEvent.press(
    screen.getByRole('button', { name: 'مواعيد العمل (اختياري)' }),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'أيام محددة' }));
  expect(
    screen.queryByRole('button', { name: 'المواعيد المشتركة — من' }),
  ).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'السبت' }));
  expect(
    screen.getByRole('button', { name: 'المواعيد المشتركة — من' }),
  ).toBeTruthy();
  await fireEvent.press(
    screen.getByRole('button', { name: 'إعدادات متقدمة لكل يوم' }),
  );
  expect(screen.queryByText('غير محدد')).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'الأحد — فترات محددة' }),
  ).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'اختيار الإثنين' }));
  expect(
    screen.getByRole('button', { name: 'الإثنين — الفترة 1 — من' }),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'اختيار الإثنين' }));
  expect(
    screen.queryByRole('button', { name: 'الإثنين — الفترة 1 — من' }),
  ).toBeNull();
});
