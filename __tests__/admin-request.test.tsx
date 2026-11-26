import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { FeedbackProvider } from '../src/components/ui/Feedback';

import { render, screen, fireEvent } from './helpers/render';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import RequestScreen from '../src/app/admin/request/[id]';
import { initialMockState } from './fixtures/moderation';
import { useProviderState } from '../src/features/provider/ProviderContext';

jest.mock('../src/features/admin/ServiceOwner', () => ({
  ServiceOwner: () => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>صاحب الحساب</Text>;
  },
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'request-changes' }),
  router: { back: jest.fn(), replace: jest.fn() },
}));
jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: jest.fn(),
}));
jest.mock('../src/features/discovery/components/DiscoveryUi', () => ({
  BackHeader: () => null,
  CategoryIcon: () => null,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));

describe('admin request review UI', () => {
  const rejectRequest = jest.fn();
  const approveRequest = jest.fn();
  const mockState = jest.mocked(useProviderState);
  beforeEach(() => {
    const state = initialMockState();
    mockState.mockReturnValue({
      ...state,
      role: 'admin',
      rejectRequest,
      approveRequest,
    } as unknown as ReturnType<typeof useProviderState>);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(['guest', 'provider'])(
    'blocks %s from rendering review actions',
    async (role) => {
      mockState.mockReturnValue({ role } as unknown as ReturnType<
        typeof useProviderState
      >);
      await render(
        <FeedbackProvider>
          <RequestScreen />
        </FeedbackProvider>,
      );
      expect(screen.getByText(/مفيش صلاحيات إدارة/)).toBeTruthy();
      expect(screen.queryByText('الموافقة على الطلب')).toBeNull();
      expect(screen.queryByText('رفض الطلب مع توضيح السبب')).toBeNull();
    },
  );

  it('shows current/proposed values only for changed fields', async () => {
    await render(
      <FeedbackProvider>
        <RequestScreen />
      </FeedbackProvider>,
    );
    expect(screen.getByText('التغييرات المقترحة فقط')).toBeTruthy();
    expect(screen.getByText('رقم التواصل')).toBeTruthy();
    expect(screen.getByText('العنوان')).toBeTruthy();
    expect(screen.queryByText('الاسم المعروض')).toBeNull();
    expect(screen.getAllByText('البيانات الحالية')).toHaveLength(2);
    expect(screen.getAllByText('البيانات المقترحة')).toHaveLength(2);
  });

  it('expands unchanged fields without repeating changed fields', async () => {
    await render(
      <FeedbackProvider>
        <RequestScreen />
      </FeedbackProvider>,
    );
    const toggle = screen.getByRole('button', {
      name: /عرض باقي بيانات الخدمة الأساسية/,
    });
    expect(screen.queryByText('الاسم المعروض')).toBeNull();
    await fireEvent.press(toggle);
    expect(screen.getByText('الاسم المعروض')).toBeTruthy();
    expect(screen.getAllByText('رقم التواصل')).toHaveLength(1);
    await fireEvent.press(toggle);
    expect(screen.queryByText('الاسم المعروض')).toBeNull();
  });
  it('opens the dialer with the proposed number for admin verification', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await render(
      <FeedbackProvider>
        <RequestScreen />
      </FeedbackProvider>,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'تجربة اتصال بالرقم الجديد' }),
    );
    expect(open).toHaveBeenCalledWith('tel:+201100000001');
  });
  it('requires a rejection reason and submits its trimmed value', async () => {
    await render(
      <FeedbackProvider>
        <RequestScreen />
      </FeedbackProvider>,
    );
    await fireEvent.press(screen.getByText('رفض الطلب مع توضيح السبب'));
    await fireEvent.press(screen.getByText('تأكيد رفض الطلب'));
    expect(rejectRequest).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(
      screen.getByText('اكتب سبب الرفض علشان صاحب الخدمة يقدر يصححه.'),
    ).toBeTruthy();
    await fireEvent.changeText(
      screen.getByLabelText('سبب الرفض'),
      '  وضح العنوان  ',
    );
    await fireEvent.press(screen.getByText('تأكيد رفض الطلب'));
    expect(rejectRequest).toHaveBeenCalledWith(
      'request-changes',
      'وضح العنوان',
    );
    expect(router.replace).toHaveBeenCalledWith('/admin');
  });

  it('cancels rejection without changing the request', async () => {
    await render(
      <FeedbackProvider>
        <RequestScreen />
      </FeedbackProvider>,
    );
    await fireEvent.press(screen.getByText('رفض الطلب مع توضيح السبب'));
    await fireEvent.changeText(
      screen.getByLabelText('سبب الرفض'),
      'سبب غير مرسل',
    );
    await fireEvent.press(screen.getByText('رجوع'));
    expect(rejectRequest).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.queryByText('تأكيد رفض الطلب')).toBeNull();
  });

  it('requires confirmation before approval and allows cancellation', async () => {
    await render(
      <FeedbackProvider>
        <RequestScreen />
      </FeedbackProvider>,
    );
    await fireEvent.press(screen.getByText('الموافقة على الطلب'));
    expect(approveRequest).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'رجوع' }));
    expect(approveRequest).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('الموافقة على الطلب'));
    await fireEvent.press(screen.getByRole('button', { name: 'موافقة ونشر' }));
    expect(approveRequest).toHaveBeenCalledWith('request-changes');
    expect(router.replace).toHaveBeenCalledWith('/admin');
  });

  it('keeps the review screen open after a failed approval', async () => {
    approveRequest.mockImplementationOnce(() => {
      return Promise.reject(new Error('الطلب تمت مراجعته بالفعل'));
    });
    await render(
      <FeedbackProvider>
        <RequestScreen />
      </FeedbackProvider>,
    );
    await fireEvent.press(screen.getByText('الموافقة على الطلب'));
    await fireEvent.press(screen.getByRole('button', { name: 'موافقة ونشر' }));
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByText('مش قادرين نكمّل الخطوة دي')).toBeTruthy();
    expect(screen.getByText('الطلب تمت مراجعته بالفعل')).toBeTruthy();
  });

  it('keeps rejection modal open with an actionable error after failure', async () => {
    rejectRequest.mockImplementationOnce(() => {
      return Promise.reject(new Error('تعذر حفظ المراجعة'));
    });
    await render(
      <FeedbackProvider>
        <RequestScreen />
      </FeedbackProvider>,
    );
    await fireEvent.press(screen.getByText('رفض الطلب مع توضيح السبب'));
    await fireEvent.changeText(
      screen.getByLabelText('سبب الرفض'),
      'وضح التخصص',
    );
    await fireEvent.press(screen.getByText('تأكيد رفض الطلب'));
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByText('تعذر حفظ المراجعة')).toBeTruthy();
    expect(screen.getByText('تأكيد رفض الطلب')).toBeTruthy();
  });
});
