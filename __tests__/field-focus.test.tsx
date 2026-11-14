import { expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from './helpers/render';
import { FormField } from '../src/features/provider/FormField';
import { colors } from '../src/theme/colors';
import { StyleSheet } from 'react-native';

it('preserves focus callbacks and prioritizes validation over focus styling', async () => {
  const focus = jest.fn();
  const blur = jest.fn();
  await render(
    <FormField label="الاسم" error="مطلوب" onFocus={focus} onBlur={blur} />,
  );
  const input = screen.getByLabelText('الاسم');
  await fireEvent(input, 'focus', {});
  expect(focus).toHaveBeenCalledTimes(1);
  expect(StyleSheet.flatten(input.props.style).borderColor).toBe(colors.error);
  await fireEvent(input, 'blur', {});
  expect(blur).toHaveBeenCalledTimes(1);
});

it('right-aligns empty Arabic placeholders and keeps numeric fields left-to-right', async () => {
  await render(
    <>
      <FormField label="اسم الخدمة" placeholder="مثال: صيانة منزلية" value="" />
      <FormField
        label="وصف الخدمة"
        placeholder="اكتب تفاصيل خدمتك"
        value=""
        multiline
      />
      <FormField
        label="رقم الموبايل"
        placeholder="01012345678"
        value=""
        phone
      />
    </>,
  );
  expect(screen.getByLabelText('اسم الخدمة').props.textAlign).toBe('right');
  expect(screen.getByLabelText('وصف الخدمة').props.textAlign).toBe('right');
  const phone = screen.getByLabelText('رقم الموبايل');
  expect(phone.props.textAlign).toBe('left');
  expect(StyleSheet.flatten(phone.props.style).writingDirection).toBe('ltr');
});
