import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from './helpers/render';
import { FeedbackProvider } from '../src/components/ui/Feedback';
import { BackHandler } from 'react-native';
import { router } from 'expo-router';
import { ServiceForm } from '../src/features/provider/ServiceForm';

const mockPreventRemove = jest.fn<
  (
    enabled: boolean,
    callback: (event: { repeat: () => void }) => void,
  ) => () => void
>(() => () => {});
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
  useFocusEffect: (callback: () => void | (() => void)) => {
    jest
      .requireActual<typeof import('react')>('react')
      .useEffect(callback, [callback]);
  },
  usePreventRemove: (...args: Parameters<typeof mockPreventRemove>) =>
    mockPreventRemove(...args),
}));
const mockSubmit =
  jest.fn<
    ReturnType<
      typeof import('../src/features/provider/ProviderContext').useProviderState
    >['submit']
  >();
jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: () => ({
    submit: mockSubmit,
    categories: jest.requireActual<
      typeof import('../src/features/discovery/data/categories')
    >('../src/features/discovery/data/categories').categories,
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));

describe('unsaved provider form confirmation', () => {
  it('keeps edited data on cancellation and invokes navigation repeat only once after confirmation', async () => {
    await render(
      <FeedbackProvider>
        <ServiceForm />
      </FeedbackProvider>,
    );
    await fireEvent.changeText(
      screen.getByLabelText('الاسم اللي هيظهر للناس *'),
      'أحمد',
    );
    const guard = mockPreventRemove.mock.calls.at(-1)!;
    expect(guard[0]).toBe(true);
    const repeat = jest.fn();
    await act(() => guard[1]({ repeat }));
    await fireEvent.press(screen.getByRole('button', { name: 'كمّل التعديل' }));
    expect(repeat).not.toHaveBeenCalled();
    expect(screen.getByLabelText('الاسم اللي هيظهر للناس *').props.value).toBe(
      'أحمد',
    );
    await act(() => guard[1]({ repeat }));
    const discard = screen.getByRole('button', { name: 'إلغاء التغييرات' });
    await fireEvent.press(discard);
    await fireEvent.press(discard);
    expect(repeat).toHaveBeenCalledTimes(1);
  });
  it('preserves entered data and never navigates to success after a failed remote submission', async () => {
    jest.mocked(router.replace).mockClear();
    mockSubmit.mockRejectedValueOnce(
      new Error('مفيش اتصال بالإنترنت. حاول تاني.'),
    );
    await render(
      <FeedbackProvider>
        <ServiceForm
          listing={{
            id: 'rejected',
            ownerId: 'owner',
            status: 'rejected',
            name: 'أحمد',
            categoryId: 'plumbing',
            serviceTitle: 'صيانة منزلية',
            description: 'وصف',
            phone: '01012345678',

            address: 'شارع المدارس',
          }}
        />
      </FeedbackProvider>,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'التالي: بيانات التواصل والمكان' }),
    );
    await fireEvent.changeText(
      screen.getByLabelText('العنوان بالتفصيل أو علامة مميزة *'),
      'عنوان احتفظ به',
    );
    await fireEvent.press(screen.getByText('في مكان ثابت'));
    await fireEvent.press(
      screen.getByRole('button', { name: 'مراجعة البيانات' }),
    );
    await fireEvent.press(screen.getAllByRole('checkbox').at(-1)!);
    await fireEvent.press(
      screen.getByRole('button', { name: 'إرسال الطلب للمراجعة' }),
    );
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByText('عنوان احتفظ به')).toBeTruthy();
    expect(screen.getByText('مفيش اتصال بالإنترنت. حاول تاني.')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
  it('handles hardware Back from step two locally and leaves step one navigation to the removal guard', async () => {
    const listener = jest.spyOn(BackHandler, 'addEventListener');
    await render(
      <FeedbackProvider>
        <ServiceForm
          listing={{
            id: 'rejected',
            ownerId: 'owner',
            status: 'rejected',
            name: 'أحمد',
            categoryId: 'plumbing',
            serviceTitle: 'صيانة منزلية',
            description: 'وصف',
            phone: '01012345678',

            address: 'شارع المدارس',
          }}
        />
      </FeedbackProvider>,
    );
    expect(screen.getByRole('progressbar').props.accessibilityValue.now).toBe(
      50,
    );
    expect(screen.getByText('أهلًا بيك في دليل أهل منشأة العمار')).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'التالي: بيانات التواصل والمكان' }),
    );
    expect(screen.getByRole('progressbar').props.accessibilityValue.now).toBe(
      100,
    );
    expect(screen.getByText('بيانات التواصل')).toBeTruthy();
    expect(screen.getByText('الموقع داخل البلد')).toBeTruthy();
    expect(screen.queryByText('وسط البلد')).toBeNull();
    expect(screen.queryByText('تحديد الموقع على الخريطة (اختياري)')).toBeNull();
    let handled: boolean | undefined;
    await act(() => {
      handled = listener.mock.calls.at(-1)![1]({
        type: 'hardwareBackPress',
        timeStamp: 0,
      });
    });
    expect(handled).toBe(true);
    expect(screen.getByLabelText('الاسم اللي هيظهر للناس *')).toBeTruthy();
    expect(
      listener.mock.calls.at(-1)![1]({
        type: 'hardwareBackPress',
        timeStamp: 0,
      }),
    ).toBe(false);
    listener.mockRestore();
  });
});

it('reviews before sending, returns from edits, and requires fresh consent', async () => {
  mockSubmit.mockClear();
  mockSubmit.mockImplementation(() => new Promise(() => {}));
  await render(
    <FeedbackProvider>
      <ServiceForm
        listing={{
          id: 'reviewed',
          ownerId: 'owner',
          status: 'rejected',
          name: 'أحمد',
          categoryId: 'plumbing',
          serviceTitle: 'صيانة',
          description: '',
          phone: '٠١٠١٢٣٤٥٦٧٨',
          address: 'شارع المدارس',
          serviceMode: 'fixed',
        }}
      />
    </FeedbackProvider>,
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'التالي: بيانات التواصل والمكان' }),
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'مراجعة البيانات' }),
  );
  expect(mockSubmit).not.toHaveBeenCalled();
  expect(screen.getByText('01012345678')).toBeTruthy();
  await fireEvent.press(
    screen.getByRole('button', { name: 'تعديل بيانات الخدمة' }),
  );
  await fireEvent.changeText(
    screen.getByLabelText('الاسم اللي هيظهر للناس *'),
    'أحمد المعدل',
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'العودة للمراجعة' }),
  );
  expect(screen.getByText('أحمد المعدل')).toBeTruthy();
  await fireEvent.press(
    screen.getByRole('button', { name: 'إرسال الطلب للمراجعة' }),
  );
  expect(mockSubmit).not.toHaveBeenCalled();
  expect(
    screen.getByText('لازم توافق على عرض البيانات قبل الإرسال.'),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole('checkbox'));
  const submit = screen.getByRole('button', { name: 'إرسال الطلب للمراجعة' });
  await fireEvent.press(submit);
  await fireEvent.press(submit);
  expect(mockSubmit).toHaveBeenCalledTimes(1);
  expect(mockSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'أحمد المعدل', phone: '01012345678' }),
    'reviewed',
    false,
    true,
    undefined,
  );
});

it('searches the real categories and closes the selection sheet on selection or backdrop', async () => {
  await render(
    <FeedbackProvider>
      <ServiceForm />
    </FeedbackProvider>,
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'اختيار نوع الخدمة' }),
  );
  await fireEvent.changeText(screen.getByLabelText('ابحث عن قسم...'), 'كهرباء');
  await fireEvent.press(
    screen.getByRole('radio', { name: 'الكهرباء والطاقة' }),
  );
  expect(screen.queryByRole('radio')).toBeNull();
  expect(screen.getByText('الكهرباء والطاقة')).toBeTruthy();
  await fireEvent.press(
    screen.getByRole('button', { name: 'اختيار نوع الخدمة' }),
  );
  await fireEvent.press(
    screen.getByRole('button', {
      name: 'إغلاق اختيار القسم',
      includeHiddenElements: true,
    }),
  );
  expect(screen.queryByRole('radio')).toBeNull();
});

it('keeps navigation gestures inside the review flow and blocks unapplied hours', async () => {
  mockSubmit.mockClear();
  await render(
    <FeedbackProvider>
      <ServiceForm
        listing={{
          id: 'hours-preview',
          ownerId: 'owner',
          status: 'approved',
          publicationStatus: 'published',
          name: 'أحمد',
          categoryId: 'plumbing',
          serviceTitle: 'صيانة',
          description: '',
          phone: '01012345678',
          address: 'عنوان',
          serviceMode: 'fixed',
        }}
      />
    </FeedbackProvider>,
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'التالي: بيانات التواصل والمكان' }),
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'مواعيد العمل (اختياري)' }),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'أيام محددة' }));
  await fireEvent.press(screen.getByRole('button', { name: 'السبت' }));
  await fireEvent.press(
    screen.getByRole('button', { name: 'مراجعة البيانات' }),
  );
  expect(
    screen.getByText(
      'طبّق المواعيد الجديدة أو احتفظ بالمواعيد الحالية قبل المراجعة.',
    ),
  ).toBeTruthy();
  expect(mockSubmit).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'تطبيق المواعيد' }));
  await fireEvent.press(
    screen.getByRole('button', { name: 'مراجعة البيانات' }),
  );
  expect(
    screen.getByRole('button', { name: 'تعديل بيانات الخدمة' }),
  ).toBeTruthy();
  const repeat = jest.fn();
  await act(() => mockPreventRemove.mock.calls.at(-1)![1]({ repeat }));
  expect(repeat).not.toHaveBeenCalled();
  expect(screen.getByLabelText('رقم الموبايل *')).toBeTruthy();
});

it.each(['rejected', 'unpublished'] as const)(
  'retains the review stage for %s resubmissions',
  async (kind) => {
    mockSubmit.mockClear();
    await render(
      <FeedbackProvider>
        <ServiceForm
          listing={{
            id: 'resubmit',
            ownerId: 'owner',
            status: kind === 'rejected' ? 'rejected' : 'approved',
            publicationStatus:
              kind === 'unpublished' ? 'unpublished' : undefined,
            unpublishReason: 'راجع البيانات',
            name: 'أحمد',
            categoryId: 'plumbing',
            serviceTitle: 'صيانة',
            description: '',
            phone: '01012345678',
            address: 'عنوان',
            serviceMode: 'fixed',
          }}
        />
      </FeedbackProvider>,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'التالي: بيانات التواصل والمكان' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'مراجعة البيانات' }),
    );
    expect(
      screen.getByRole('button', { name: 'إرسال الطلب للمراجعة' }),
    ).toBeTruthy();
    expect(screen.getByRole('checkbox').props.accessibilityState.checked).toBe(
      false,
    );
    expect(mockSubmit).not.toHaveBeenCalled();
  },
);
