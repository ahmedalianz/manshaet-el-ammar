import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from './helpers/render';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import Dashboard from '../src/app/admin';
import Report from '../src/app/admin/report/[id]';
import { FeedbackProvider } from '../src/components/ui/Feedback';
import { initialMockState } from './fixtures/moderation';
let mockState = initialMockState();
const mockClose = jest.fn();
jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: () => ({
    ...mockState,
    role: 'admin',
    privateRefreshing: false,
    pendingRequests: mockState.requests.filter(
      (request) => request.status === 'pending',
    ),
    closeReport: mockClose,
    refresh: jest.fn(),
  }),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'report-open' }),
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));
beforeEach(() => {
  mockState = initialMockState();
  jest.clearAllMocks();
});
it('sorts actual review requests newest first and reverses their order', async () => {
  mockState.requests.find(
    (request) => request.id === 'request-pending',
  )!.createdAt = '2026-11-01T10:00:00.000Z';
  mockState.requests.find(
    (request) => request.id === 'request-changes',
  )!.createdAt = '2026-11-02T10:00:00.000Z';
  await render(<Dashboard />);
  const labels = () =>
    screen
      .getAllByRole('button', { name: /^مراجعة / })
      .map((button) => button.props.accessibilityLabel);
  const newest = labels();
  expect(newest[0]).toContain(
    mockState.requests.find((request) => request.id === 'request-changes')!
      .proposedData.serviceTitle,
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'الفرز: الأحدث أولًا' }),
  );
  expect(labels()).toEqual([...newest].reverse());
  expect(
    screen.getByRole('button', { name: 'الفرز: الأقدم أولًا' }),
  ).toBeTruthy();
});
it('previews the reported service and confirms report closure separately from publication', async () => {
  await render(
    <FeedbackProvider>
      <Report />
    </FeedbackProvider>,
  );
  const report = mockState.reports.find(
    (report) => report.id === 'report-open',
  )!;
  await fireEvent.press(
    screen.getByRole('button', { name: 'معاينة الخدمة في الدليل' }),
  );
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/provider/[id]',
    params: { id: report.providerId },
  });
  await fireEvent.press(screen.getByRole('button', { name: 'إغلاق البلاغ' }));
  expect(mockClose).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'تأكيد الإغلاق' }));
  expect(mockClose).toHaveBeenCalledWith('report-open');
});
it('shows a useful error when the admin verification dialer fails', async () => {
  const report = mockState.reports.find(
    (report) => report.id === 'report-open',
  )!;
  mockState.services.find(
    (service) => service.id === report.providerId,
  )!.phone = '01012345678';
  const open = jest
    .spyOn(Linking, 'openURL')
    .mockRejectedValue(new Error('Unavailable'));
  await render(
    <FeedbackProvider>
      <Report />
    </FeedbackProvider>,
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'اتصال للتأكد من الرقم' }),
  );
  expect(screen.getByText('مش قادرين نتواصل دلوقتي')).toBeTruthy();
  open.mockRestore();
});

it('keeps unpublished services in a searchable archive with their reason and a details route', async () => {
  const service = mockState.services.find(
    (item) => item.id === 'owned-unpublished',
  )!;
  service.unpublishReason = 'راجع رقم التواصل';
  await render(<Dashboard />);
  await fireEvent.press(screen.getByRole('tab', { name: 'الأرشيف' }));
  expect(screen.getByText('سبب الإخفاء: راجع رقم التواصل')).toBeTruthy();
  await fireEvent.press(
    screen.getByRole('button', { name: `إدارة ${service.serviceTitle}` }),
  );
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/admin/service/[id]',
    params: { id: service.id },
  });
  await fireEvent.changeText(
    screen.getByPlaceholderText('ابحث باسم الخدمة أو صاحبها...'),
    'اسم مش موجود',
  );
  expect(screen.getByText('مفيش خدمات مطابقة للبحث.')).toBeTruthy();
});
