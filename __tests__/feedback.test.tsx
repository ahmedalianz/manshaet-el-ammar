import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { act, fireEvent, render, screen } from './helpers/render';
import { AccessibilityInfo, Pressable, Text } from 'react-native';
import { FeedbackProvider, useFeedback } from '../src/components/ui/Feedback';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));
const confirmed = jest.fn(),
  cancelled = jest.fn();
function Demo() {
  const feedback = useFeedback();
  const buttons = [
    { text: 'إلغاء', style: 'cancel' as const, onPress: cancelled },
    { text: 'متابعة', style: 'destructive' as const, onPress: confirmed },
  ];
  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => feedback.show('تم النسخ', 'تم نسخ رقم العرض التجريبي.')}
      >
        <Text>نسخ تجريبي</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => feedback.show('مش قادرين نحفظ التعديلات', 'جرّب تاني.')}
      >
        <Text>خطأ تجريبي</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          feedback.show('تأكيد التغيير', 'راجع التغيير قبل المتابعة.', buttons)
        }
      >
        <Text>فتح التأكيد</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          feedback.show('الأول', 'تأكيد أول', buttons);
          feedback.show('الثاني', 'تأكيد ثان', buttons);
        }}
      >
        <Text>فتح اثنين</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          feedback.show('تأكيد واحد', 'لن يتكرر', buttons, { key: 'same' });
          feedback.show('تأكيد واحد', 'لن يتكرر', buttons, { key: 'same' });
        }}
      >
        <Text>فتح مكرر</Text>
      </Pressable>
    </>
  );
}
const setup = () =>
  render(
    <FeedbackProvider>
      <Demo />
    </FeedbackProvider>,
  );
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
    .mockResolvedValue(false);
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('themed app feedback', () => {
  it('shows nonblocking accessible copy feedback with an explicit dismiss action', async () => {
    await setup();
    await fireEvent.press(screen.getByText('نسخ تجريبي'));
    expect(screen.getByText('تم النسخ')).toBeTruthy();
    expect(
      screen.getByText('تم نسخ رقم العرض التجريبي.').props.allowFontScaling,
    ).not.toBe(false);
    expect(screen.getByRole('alert').props.accessibilityLiveRegion).toBe(
      'polite',
    );
    expect(screen.getByText('فتح التأكيد')).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'إغلاق الإشعار' }),
    );
    expect(screen.queryByText('تم النسخ')).toBeNull();
  });
  it('does not execute a destructive callback until explicit confirmation', async () => {
    await setup();
    await fireEvent.press(screen.getByText('فتح التأكيد'));
    expect(confirmed).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'إلغاء' }));
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(confirmed).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('فتح التأكيد'));
    const button = screen.getByRole('button', { name: 'متابعة' });
    await fireEvent.press(button);
    await fireEvent.press(button);
    expect(confirmed).toHaveBeenCalledTimes(1);
  });
  it('maps hardware back to cancellation and never confirms', async () => {
    await setup();
    await fireEvent.press(screen.getByText('فتح التأكيد'));
    await act(() =>
      screen.getByTestId('feedback-dialog').props.onRequestClose(),
    );
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(confirmed).not.toHaveBeenCalled();
    expect(screen.queryByText('تأكيد التغيير')).toBeNull();
  });
  it('preserves queued confirmations and their callbacks', async () => {
    await setup();
    await fireEvent.press(screen.getByText('فتح اثنين'));
    expect(screen.getByText('الأول')).toBeTruthy();
    expect(screen.queryByText('الثاني')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'متابعة' }));
    expect(screen.getByText('الثاني')).toBeTruthy();
    expect(confirmed).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'إلغاء' }));
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(confirmed).toHaveBeenCalledTimes(1);
  });
  it('deduplicates the same guarded dialog without repeating its callback', async () => {
    await setup();
    await fireEvent.press(screen.getByText('فتح مكرر'));
    await fireEvent.press(screen.getByRole('button', { name: 'متابعة' }));
    expect(screen.queryByText('تأكيد واحد')).toBeNull();
    expect(confirmed).toHaveBeenCalledTimes(1);
  });
  it('dismisses ordinary notifications after their timeout', async () => {
    jest.useFakeTimers();
    await setup();
    await fireEvent.press(screen.getByText('نسخ تجريبي'));
    await act(() => jest.advanceTimersByTime(4000));
    expect(screen.queryByText('تم النسخ')).toBeNull();
  });
  it('does not automatically remove notifications for screen reader users', async () => {
    jest.useFakeTimers();
    jest
      .mocked(AccessibilityInfo.isScreenReaderEnabled)
      .mockResolvedValue(true);
    await setup();
    await fireEvent.press(screen.getByText('خطأ تجريبي'));
    await act(() => jest.advanceTimersByTime(30000));
    expect(screen.getByText('مش قادرين نحفظ التعديلات')).toBeTruthy();
  });
});
