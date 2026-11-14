import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent, within } from './helpers/render';
import { useEffect } from 'react';
import { Button } from 'react-native';
import AdminScreen from '../src/app/admin';
import {
  ProviderStateProvider,
  useProviderState,
} from './fixtures/MockProviderContext';
import { initialMockState } from './fixtures/moderation';
jest.mock('../src/features/provider/ProviderContext', () =>
  jest.requireActual('./fixtures/MockProviderContext'),
);

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));

function AdminSession() {
  const { role, signIn, approveRequest, closeReport } = useProviderState();
  useEffect(() => {
    if (role !== 'admin') signIn('admin');
  }, [role, signIn]);
  return (
    <>
      <Button
        title="Approve fixture for synchronization check"
        onPress={() => approveRequest('request-pending')}
      />
      <Button
        title="Close fixture for synchronization check"
        onPress={() => closeReport('report-open')}
      />
      <AdminScreen />
    </>
  );
}
const renderDashboard = () =>
  render(
    <ProviderStateProvider>
      <AdminSession />
    </ProviderStateProvider>,
  );

describe('admin dashboard tabs and live counts', () => {
  it('opens the matching list from each summary card', async () => {
    await renderDashboard();
    for (const label of [
      'الخدمات المنشورة',
      'الأرشيف',
      'البلاغات',
      'طلبات المراجعة',
    ]) {
      await fireEvent.press(
        screen.getByRole('button', { name: `عرض ${label}` }),
      );
      expect(
        screen.getByRole('tab', { name: label }).props.accessibilityState
          .selected,
      ).toBe(true);
    }
    expect(
      screen.getByRole('button', { name: 'مراجعة خدمة تجريبية قيد المراجعة' }),
    ).toBeTruthy();
  });

  it('defaults to pending requests only and computes counters from repository state', async () => {
    const state = initialMockState();
    await renderDashboard();
    const pending = state.requests.filter(
      (request) => request.status === 'pending',
    );
    const published = state.services.filter(
      (service) => service.publicationStatus === 'published',
    );
    const open = state.reports.filter((report) => report.status === 'open');
    const requestsTab = screen.getByRole('tab', { name: 'طلبات المراجعة' });
    expect(requestsTab.props.accessibilityState.selected).toBe(true);
    expect(within(requestsTab).getByText(String(pending.length))).toBeTruthy();
    expect(
      within(screen.getByRole('tab', { name: 'الخدمات المنشورة' })).getByText(
        String(published.length),
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByRole('tab', { name: 'البلاغات' })).getByText(
        String(open.length),
      ),
    ).toBeTruthy();
    for (const request of pending)
      expect(
        screen.getByRole('button', {
          name: `مراجعة ${request.proposedData.serviceTitle}`,
        }),
      ).toBeTruthy();
    expect(screen.queryByText('خدمة تجريبية تحتاج تعديل')).toBeNull();
    expect(screen.queryByRole('button', { name: 'مراجعة البلاغ' })).toBeNull();
    expect(screen.queryByLabelText('ابحث باسم الخدمة أو صاحبها...')).toBeNull();
  });

  it('searches published services by owner name and service title with an empty state', async () => {
    await renderDashboard();
    await fireEvent.press(
      screen.getByRole('tab', { name: 'الخدمات المنشورة' }),
    );
    const search = screen.getByLabelText('ابحث باسم الخدمة أو صاحبها...');
    await fireEvent.changeText(search, 'محمد حسين');
    expect(
      screen.getByRole('button', { name: 'إدارة فني كهرباء وتأسيس منازل' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'إدارة عيادة باطنة وأطفال' }),
    ).toBeNull();
    await fireEvent.changeText(search, 'عيادة باطنة');
    expect(
      screen.getByRole('button', { name: 'إدارة عيادة باطنة وأطفال' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'إدارة فني كهرباء وتأسيس منازل' }),
    ).toBeNull();
    await fireEvent.changeText(search, 'zzzz-no-match');
    expect(screen.getByText('مفيش خدمات مطابقة للبحث.')).toBeTruthy();
  });

  it('updates request and published counts after moderation in the shared context', async () => {
    const state = initialMockState();
    await renderDashboard();
    await fireEvent.press(
      screen.getByText('Approve fixture for synchronization check'),
    );
    expect(
      screen.queryByRole('button', {
        name: 'مراجعة خدمة تجريبية قيد المراجعة',
      }),
    ).toBeNull();
    expect(
      within(screen.getByRole('tab', { name: 'طلبات المراجعة' })).getByText(
        '1',
      ),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('tab', { name: 'الخدمات المنشورة' }),
    );
    expect(
      within(screen.getByRole('tab', { name: 'الخدمات المنشورة' })).getByText(
        String(
          state.services.filter(
            (service) => service.publicationStatus === 'published',
          ).length + 1,
        ),
      ),
    ).toBeTruthy();
    await fireEvent.changeText(
      screen.getByLabelText('ابحث باسم الخدمة أو صاحبها...'),
      'خدمة تجريبية قيد المراجعة',
    );
    expect(
      screen.getByRole('button', { name: 'إدارة خدمة تجريبية قيد المراجعة' }),
    ).toBeTruthy();
  });

  it('shows only open reports and removes a closed report immediately', async () => {
    const state = initialMockState();
    await renderDashboard();
    await fireEvent.press(screen.getByRole('tab', { name: 'البلاغات' }));
    expect(
      screen.getAllByRole('button', { name: 'مراجعة البلاغ' }),
    ).toHaveLength(3);
    await fireEvent.press(
      screen.getByText('Close fixture for synchronization check'),
    );
    expect(
      screen.queryByText(
        state.reports.find((report) => report.id === 'report-open')!.reason,
      ),
    ).toBeNull();
    expect(
      screen.getAllByRole('button', { name: 'مراجعة البلاغ' }),
    ).toHaveLength(2);
    expect(
      within(screen.getByRole('tab', { name: 'البلاغات' })).getByText('2'),
    ).toBeTruthy();
    expect(screen.queryByLabelText('ابحث باسم الخدمة أو صاحبها...')).toBeNull();
  });
});
