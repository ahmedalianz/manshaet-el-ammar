import { beforeEach, afterEach, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from './helpers/render';
import { ServiceForm } from '../src/features/provider/ServiceForm';
import {
  clearUserDrafts,
  readDraft,
  saveDraft,
} from '../src/features/local/drafts';
import type { FeedbackApi } from '../src/components/ui/Feedback';
import type { ProviderListing } from '../src/features/provider/types';

const mockStorageWrite = jest
  .mocked(AsyncStorage.setItem)
  .getMockImplementation()!;
const mockShow = jest.fn<FeedbackApi['show']>();
const mockDismiss = jest.fn<NonNullable<FeedbackApi['dismiss']>>();
const mockSubmit = jest.fn(async () => 'submitted-service-1');
jest.mock('../src/components/ui/Feedback', () => ({
  useFeedback: () => ({
    show: (...args: Parameters<FeedbackApi['show']>) => mockShow(...args),
    dismiss: (key: string) => mockDismiss(key),
  }),
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
  useFocusEffect: () => {},
  usePreventRemove: () => () => {},
}));
jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: () => ({
    userId: 'draft-test-owner',
    submit: mockSubmit,
    categories: jest.requireActual<
      typeof import('../src/features/discovery/data/categories')
    >('../src/features/discovery/data/categories').categories,
  }),
}));
beforeEach(async () => {
  jest.useRealTimers();
  await clearUserDrafts('draft-test-owner');
  mockShow.mockClear();
  mockDismiss.mockClear();
  mockSubmit.mockClear();
});
afterEach(async () => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.mocked(AsyncStorage.setItem).mockImplementation(mockStorageWrite);
  await clearUserDrafts('draft-test-owner');
});
it('autosaves after 750ms and never persists publication consent', async () => {
  await render(<ServiceForm />);
  await act(async () => {});
  jest.useFakeTimers();
  await fireEvent.changeText(
    screen.getByLabelText('الاسم اللي هيظهر للناس *'),
    'اسم المسودة',
  );
  await act(() => jest.advanceTimersByTime(749));
  expect(await readDraft('draft-test-owner', 'new')).toBeNull();
  await act(() => jest.advanceTimersByTime(1));
  const draft = await readDraft('draft-test-owner', 'new');
  expect(draft?.values.name).toBe('اسم المسودة');
  expect(draft).not.toHaveProperty('consent');
  expect(screen.getByText('المسودة اتحفظت على الجهاز.')).toBeTruthy();
});
it('shows storage failure instead of claiming that a draft was saved', async () => {
  await render(<ServiceForm />);
  await act(async () => {});
  jest.useFakeTimers();
  const original = mockStorageWrite;
  jest.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, value) => {
    if (key.startsWith('directory.draft.')) throw new Error('disk full');
    return original(key, value);
  });
  await fireEvent.changeText(
    screen.getByLabelText('الاسم اللي هيظهر للناس *'),
    'مسودة',
  );
  await act(() => jest.advanceTimersByTime(750));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  await waitFor(() =>
    expect(
      screen.getByText('مش قادرين نحفظ المسودة. سيب الصفحة مفتوحة وجرّب تاني.'),
    ).toBeTruthy(),
  );
  expect(screen.queryByText('المسودة اتحفظت على الجهاز.')).toBeNull();
});
it('restores step and WhatsApp toggle but asks for fresh publication consent', async () => {
  await saveDraft('draft-test-owner', 'new', {
    values: {
      name: 'أحمد',
      categoryId: 'plumbing',
      serviceTitle: 'سباك',
      description: '',
      phone: '01012345678',
      whatsapp: '01012345678',

      address: 'شارع المدرسة',
      serviceMode: 'fixed',
    },
    step: 2,
    sameNumber: true,
    savedAt: new Date().toISOString(),
  });
  await render(<ServiceForm />);
  await waitFor(() => expect(mockShow).toHaveBeenCalled());
  const buttons = mockShow.mock.calls.at(-1)![2]!;
  await act(() =>
    buttons.find((button) => button.text === 'استعادة المسودة')!.onPress!(),
  );
  expect(screen.getByLabelText('رقم التواصل *').props.value).toBe(
    '01012345678',
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'مراجعة البيانات' }),
  );
  const consent = screen.getAllByRole('checkbox').at(-1)!;
  expect(consent.props.accessibilityState.checked).toBe(false);
});

const editListing: ProviderListing = {
  id: 'edit-listing-1',
  ownerId: 'draft-test-owner',
  status: 'approved',
  publicationStatus: 'published',
  name: 'جيهان عبدالرحمن',
  categoryId: 'shops',
  serviceTitle: 'مستلزمات منزلية',
  description: 'خدمة يومية',
  phone: '01012345678',
  whatsapp: '01012345678',
  address: 'شارع المدارس',
  serviceMode: 'fixed',
  updatedAt: '2026-11-18T10:00:00.000Z',
};

it('never saves a phantom draft when editing a same-number listing or stepping without edits', async () => {
  const view = await render(<ServiceForm listing={editListing} />);
  await act(async () => {});
  jest.useFakeTimers();

  await fireEvent.press(
    screen.getByRole('button', { name: 'التالي: بيانات التواصل والمكان' }),
  );
  await act(() => jest.advanceTimersByTime(800));
  expect(await readDraft('draft-test-owner', editListing.id)).toBeNull();

  await view.unmount();
  expect(await readDraft('draft-test-owner', editListing.id)).toBeNull();
  expect(mockShow).not.toHaveBeenCalled();
});

it('silently ignores and discards an existing unchanged phantom draft on edit', async () => {
  await saveDraft('draft-test-owner', editListing.id, {
    values: {
      name: editListing.name,
      categoryId: editListing.categoryId,
      serviceTitle: editListing.serviceTitle,
      description: editListing.description,
      phone: editListing.phone,
      whatsapp: editListing.whatsapp,
      address: editListing.address,
      serviceMode: editListing.serviceMode,
    },
    step: 1,
    sameNumber: true,
    baseRevision: editListing.updatedAt,
    savedAt: new Date().toISOString(),
  });

  await render(<ServiceForm listing={editListing} />);
  await act(async () => {});

  expect(mockShow).not.toHaveBeenCalled();
  await waitFor(async () =>
    expect(await readDraft('draft-test-owner', editListing.id)).toBeNull(),
  );
});

it('does not re-open the draft prompt when live listing props update after autosaving edits', async () => {
  const view = await render(<ServiceForm listing={editListing} />);
  await act(async () => {});
  jest.useFakeTimers();

  await fireEvent.changeText(
    screen.getByLabelText('الاسم اللي هيظهر للناس *'),
    'جيهان عبدالرحمن - محدث',
  );
  await act(() => jest.advanceTimersByTime(750));
  expect(await readDraft('draft-test-owner', editListing.id)).not.toBeNull();
  mockShow.mockClear();

  await view.rerender(
    <ServiceForm
      listing={{ ...editListing, updatedAt: '2026-11-18T12:00:00.000Z' }}
    />,
  );
  await act(async () => {});

  expect(mockShow).not.toHaveBeenCalled();
});

it('clears autosaved draft on submit, prevents unmount re-save, and dismisses draft modals', async () => {
  const view = await render(<ServiceForm />);
  await act(async () => {});
  jest.useFakeTimers();

  await fireEvent.changeText(
    screen.getByLabelText('الاسم اللي هيظهر للناس *'),
    'أحمد علي',
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'اختيار نوع الخدمة' }),
  );
  await fireEvent.press(
    screen.getByRole('radio', { name: 'السباكة والمضخات' }),
  );
  await fireEvent.changeText(
    screen.getByLabelText('تخصصك أو اسم مختصر لخدمتك *'),
    'سباك صحي',
  );

  await act(() => jest.advanceTimersByTime(750));
  expect(await readDraft('draft-test-owner', 'new')).not.toBeNull();

  await fireEvent.press(
    screen.getByRole('button', { name: 'التالي: بيانات التواصل والمكان' }),
  );
  await fireEvent.changeText(
    screen.getByLabelText('رقم التواصل *'),
    '01012345678',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'في مكان ثابت' }));
  await fireEvent.changeText(
    screen.getByLabelText('العنوان بالتفصيل أو علامة مميزة *'),
    'شارع المدارس',
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'مراجعة البيانات' }),
  );
  await fireEvent.press(screen.getAllByRole('checkbox').at(-1)!);
  await fireEvent.press(
    screen.getByRole('button', { name: 'إرسال الطلب للمراجعة' }),
  );

  await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
  expect(mockDismiss).toHaveBeenCalledWith('restore-service-draft');

  await view.unmount();
  expect(await readDraft('draft-test-owner', 'new')).toBeNull();
  expect(mockDismiss).toHaveBeenCalledWith('discard-service-changes');
});

it('deletes the autosaved draft when edits are reverted back to initial values', async () => {
  await render(<ServiceForm />);
  await act(async () => {});
  jest.useFakeTimers();

  await fireEvent.changeText(
    screen.getByLabelText('الاسم اللي هيظهر للناس *'),
    'تغيير مؤقت',
  );
  await act(() => jest.advanceTimersByTime(750));
  expect(await readDraft('draft-test-owner', 'new')).not.toBeNull();

  await fireEvent.changeText(
    screen.getByLabelText('الاسم اللي هيظهر للناس *'),
    '',
  );
  await act(() => jest.advanceTimersByTime(750));
  expect(await readDraft('draft-test-owner', 'new')).toBeNull();
});

it('auto-restores non-stale drafts without modal when autoRestoreDraft is enabled', async () => {
  await saveDraft('draft-test-owner', 'new', {
    values: {
      name: 'اسم مستعاد',
      categoryId: 'plumbing',
      serviceTitle: 'سباك',
      description: '',
      phone: '01012345678',
      whatsapp: '01012345678',
      address: 'شارع المدارس',
      serviceMode: 'fixed',
    },
    step: 1,
    sameNumber: true,
    savedAt: new Date().toISOString(),
  });

  await render(<ServiceForm autoRestoreDraft />);
  await waitFor(() =>
    expect(screen.getByDisplayValue('اسم مستعاد')).toBeTruthy(),
  );
  expect(mockShow).not.toHaveBeenCalled();
});
