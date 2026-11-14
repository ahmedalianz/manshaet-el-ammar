import { describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from './helpers/render';
import {
  ProviderStateProvider,
  useProviderState,
} from './fixtures/MockProviderContext';
jest.mock('../src/features/provider/ProviderContext', () =>
  jest.requireActual('./fixtures/MockProviderContext'),
);

describe('shared mock repository integration', () => {
  it('keeps approval synchronized across admin, owner and public sessions', async () => {
    const { result } = await renderHook(useProviderState, {
      wrapper: ProviderStateProvider,
    });
    expect(result.current.role).toBe('guest');
    expect(result.current.listings).toEqual([]);
    await act(() => result.current.signIn('admin'));
    expect(
      result.current.pendingRequests.some(
        (request) => request.id === 'request-pending',
      ),
    ).toBe(true);
    await act(() => result.current.approveRequest('request-pending'));
    expect(
      result.current.pendingRequests.some(
        (request) => request.id === 'request-pending',
      ),
    ).toBe(false);
    expect(
      result.current.publicProviders.some(
        (provider) => provider.id === 'owned-pending',
      ),
    ).toBe(true);
    await act(() => result.current.signIn('listings'));
    expect(
      result.current.listings.find((listing) => listing.id === 'owned-pending')
        ?.status,
    ).toBe('approved');
    await act(() => result.current.signOut());
    expect(result.current.listings).toEqual([]);
    expect(
      result.current.publicProviders.some(
        (provider) => provider.id === 'owned-pending',
      ),
    ).toBe(true);
  });

  it('processes back-to-back moderation actions against current state', async () => {
    const { result } = await renderHook(useProviderState, {
      wrapper: ProviderStateProvider,
    });
    await act(() => {
      result.current.signIn('admin');
      result.current.approveRequest('request-pending');
      result.current.rejectRequest('request-changes', 'راجع العنوان');
      result.current.closeReport('report-open');
    });
    expect(
      result.current.requests.find(
        (request) => request.id === 'request-pending',
      )?.status,
    ).toBe('approved');
    expect(
      result.current.requests.find(
        (request) => request.id === 'request-changes',
      )?.status,
    ).toBe('rejected');
    expect(
      result.current.reports.find((report) => report.id === 'report-open')
        ?.status,
    ).toBe('closed');
  });

  it('removes unpublished services from every public view but retains owner history', async () => {
    const { result } = await renderHook(useProviderState, {
      wrapper: ProviderStateProvider,
    });
    await act(() => result.current.signIn('admin'));
    await act(() =>
      result.current.unpublishService('owned-approved', 'راجع الرقم'),
    );
    expect(
      result.current.publicProviders.some(
        (provider) => provider.id === 'owned-approved',
      ),
    ).toBe(false);
    await act(() => result.current.signIn('listings'));
    expect(
      result.current.listings.find((listing) => listing.id === 'owned-approved')
        ?.publicationStatus,
    ).toBe('unpublished');
  });

  it('blocks unauthorized actions through the shared context boundary', async () => {
    const { result } = await renderHook(useProviderState, {
      wrapper: ProviderStateProvider,
    });
    expect(() => result.current.approveRequest('request-pending')).toThrow();
    await act(() => result.current.signIn('listings'));
    expect(() => result.current.closeReport('report-open')).toThrow();
    expect(
      result.current.requests.find(
        (request) => request.id === 'request-pending',
      )?.status,
    ).toBe('pending');
  });

  it('rejects duplicate review in the same tick without duplicating published services', async () => {
    const { result } = await renderHook(useProviderState, {
      wrapper: ProviderStateProvider,
    });
    await act(() => {
      result.current.signIn('admin');
      result.current.approveRequest('request-pending');
      expect(() => result.current.approveRequest('request-pending')).toThrow();
    });
    expect(
      result.current.services.filter(
        (service) => service.id === 'owned-pending',
      ),
    ).toHaveLength(1);
    expect(
      result.current.requests.find(
        (request) => request.id === 'request-pending',
      )?.status,
    ).toBe('approved');
  });
});

it('isolates private context data and preserves records across sign-out', async () => {
  const { result } = await renderHook(useProviderState, {
    wrapper: ProviderStateProvider,
  });
  expect(result.current.requests).toEqual([]);
  expect(result.current.reports).toEqual([]);
  await act(() => result.current.signIn('listings'));
  const ids = result.current.requests.map((request) => request.id);
  expect(ids.length).toBeGreaterThan(0);
  expect(result.current.reports).toEqual([]);
  await act(() => result.current.signIn('empty'));
  expect(result.current.requests).toEqual([]);
  expect(result.current.listings).toEqual([]);
  await act(() => result.current.signOut());
  await act(() => result.current.signIn('listings'));
  expect(result.current.requests.map((request) => request.id)).toEqual(ids);
});
