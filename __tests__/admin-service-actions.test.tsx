import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from './helpers/render';
import { router } from 'expo-router';
import { FeedbackProvider } from '../src/components/ui/Feedback';
import {
  DeleteServiceAction,
  UnpublishAction,
  RestoreAction,
} from '../src/features/admin/AdminUi';
const mockDelete = jest.fn<(id: string) => Promise<void>>();
const mockUnpublish = jest.fn<(id: string, reason: string) => Promise<void>>();
const mockRestore = jest.fn<(id: string) => Promise<void>>();
let mockBusy = false;
jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: () => ({
    deleteService: mockDelete,
    unpublishService: mockUnpublish,
    adminBusy: mockBusy,
    restoreService: mockRestore,
    pendingRequests: [],
  }),
}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
const setup = () =>
  render(
    <FeedbackProvider>
      <UnpublishAction id="p1" />
      <RestoreAction id="p1" />
      <DeleteServiceAction id="p1" />
    </FeedbackProvider>,
  );
beforeEach(() => {
  jest.clearAllMocks();
  mockDelete.mockResolvedValue(undefined);
  mockUnpublish.mockResolvedValue(undefined);
  mockBusy = false;
});
it('requires explicit confirmation and allows cancelling permanent deletion', async () => {
  await setup();
  await fireEvent.press(
    screen.getByRole('button', { name: 'حذف الخدمة نهائيًا' }),
  );
  expect(mockDelete).not.toHaveBeenCalled();
  expect(
    screen.getByText(/هيتم حذف الخدمة وطلبات إضافتها وتعديلها/),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'رجوع' }));
  expect(mockDelete).not.toHaveBeenCalled();
});
it('deletes only after confirmation and returns to administration on success', async () => {
  await setup();
  await fireEvent.press(
    screen.getByRole('button', { name: 'حذف الخدمة نهائيًا' }),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'حذف نهائي' }));
  await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('p1'));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/admin'));
});
it('keeps the service screen and shows a failure when deletion is denied', async () => {
  mockDelete.mockRejectedValue(new Error('صلاحيات غير كافية'));
  await setup();
  await fireEvent.press(
    screen.getByRole('button', { name: 'حذف الخدمة نهائيًا' }),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'حذف نهائي' }));
  await waitFor(() =>
    expect(screen.getByText('صلاحيات غير كافية')).toBeTruthy(),
  );
  expect(router.replace).not.toHaveBeenCalled();
});
it('keeps unpublish separate from permanent deletion', async () => {
  await setup();
  await fireEvent.press(
    screen.getByRole('button', { name: 'إلغاء نشر الخدمة' }),
  );
  expect(mockUnpublish).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole('button', { name: 'تأكيد إخفاء الخدمة' }),
  );
  expect(mockUnpublish).not.toHaveBeenCalled();
  expect(
    screen.getByText('اكتب سبب واضح يساعد صاحب الخدمة يصحّح بياناته.'),
  ).toBeTruthy();
  await fireEvent.changeText(
    screen.getByLabelText('سبب إخفاء الخدمة'),
    ' راجع رقم التواصل ',
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'تأكيد إخفاء الخدمة' }),
  );
  await waitFor(() =>
    expect(mockUnpublish).toHaveBeenCalledWith('p1', 'راجع رقم التواصل'),
  );
  expect(mockDelete).not.toHaveBeenCalled();
});
it('disables both actions while moderation is running', async () => {
  mockBusy = true;
  await setup();
  for (const name of ['إلغاء نشر الخدمة', 'حذف الخدمة نهائيًا'])
    expect(
      screen.getByRole('button', { name }).props.accessibilityState.disabled,
    ).toBe(true);
});

it('requires a separate explicit confirmation to restore and allows cancellation', async () => {
  mockRestore.mockResolvedValue(undefined);
  await setup();
  await fireEvent.press(
    screen.getByRole('button', { name: 'استرجاع الخدمة للدليل' }),
  );
  expect(mockRestore).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'رجوع' }));
  expect(mockRestore).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole('button', { name: 'استرجاع الخدمة للدليل' }),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'استرجاع ونشر' }));
  await waitFor(() => expect(mockRestore).toHaveBeenCalledWith('p1'));
});
it('cancels unpublishing without calling the operation', async () => {
  await setup();
  await fireEvent.press(
    screen.getByRole('button', { name: 'إلغاء نشر الخدمة' }),
  );
  await fireEvent.changeText(
    screen.getByLabelText('سبب إخفاء الخدمة'),
    'سبب تجريبي',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'رجوع' }));
  expect(mockUnpublish).not.toHaveBeenCalled();
});
