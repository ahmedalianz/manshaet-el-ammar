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
const mockStorageWrite = jest
  .mocked(AsyncStorage.setItem)
  .getMockImplementation()!;
const mockShow = jest.fn<FeedbackApi['show']>();
jest.mock('../src/components/ui/Feedback', () => ({
  useFeedback: () => ({
    show: (...args: Parameters<FeedbackApi['show']>) => mockShow(...args),
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
    submit: jest.fn(),
    categories: jest.requireActual<
      typeof import('../src/features/discovery/data/categories')
    >('../src/features/discovery/data/categories').categories,
  }),
}));
beforeEach(async () => {
  jest.useRealTimers();
  await clearUserDrafts('draft-test-owner');
  mockShow.mockClear();
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

      address: 'شارع المدارس',
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
  expect(screen.getByLabelText('رقم الموبايل *').props.value).toBe(
    '01012345678',
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'مراجعة البيانات' }),
  );
  const consent = screen.getAllByRole('checkbox').at(-1)!;
  expect(consent.props.accessibilityState.checked).toBe(false);
});
