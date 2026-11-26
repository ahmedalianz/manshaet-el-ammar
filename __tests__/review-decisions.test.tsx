import { beforeEach, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import {
  latestReviewDecisions,
  reviewDecisionKey,
  reviewSeenStorageKey,
  useReviewDecisions,
} from '../src/features/provider/useReviewDecisions';
import type {
  ProviderListing,
  ServiceRequest,
} from '../src/features/provider/types';
import { providers } from './fixtures/providers';
const listings: ProviderListing[] = [
  { ...providers[0], id: 'service', ownerId: 'owner' },
];
const approved: ServiceRequest = {
  id: 'request',
  providerId: 'service',
  ownerId: 'owner',
  type: 'create',
  status: 'approved',
  proposedData: listings[0],
  createdAt: '2026-11-10T10:00:00Z',
  reviewedAt: '2026-11-11T10:00:00Z',
};
const defaultGet = jest.mocked(AsyncStorage.getItem).getMockImplementation()!;
const defaultSet = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
beforeEach(async () => {
  jest.mocked(AsyncStorage.getItem).mockReset().mockImplementation(defaultGet);
  jest.mocked(AsyncStorage.setItem).mockReset().mockImplementation(defaultSet);
  await AsyncStorage.clear();
});
it('selects the latest final decision for each owned listing, excluding pending and foreign reviews', () => {
  const newer = {
    ...approved,
    id: 'edit',
    type: 'update' as const,
    status: 'rejected' as const,
    reviewedAt: '2026-11-12T10:00:00Z',
  };
  expect(
    latestReviewDecisions('owner', listings, [
      approved,
      newer,
      { ...approved, id: 'pending', status: 'pending' },
      { ...newer, id: 'foreign', ownerId: 'other' },
    ]),
  ).toEqual([newer]);
});
it('detects pending-to-approved and rejected-edit outcomes without requiring a listing status change', async () => {
  const hook = await renderHook(
    ({ requests }: { requests: ServiceRequest[] }) =>
      useReviewDecisions('owner', listings, requests),
    { initialProps: { requests: [{ ...approved, status: 'pending' }] } },
  );
  expect(hook.result.current.unread).toEqual([]);
  await hook.rerender({ requests: [approved] });
  await waitFor(() => expect(hook.result.current.unread).toEqual([approved]));
  const rejectedEdit = {
    ...approved,
    id: 'edit',
    type: 'update' as const,
    status: 'rejected' as const,
    rejectionReason: 'وضح العنوان',
    reviewedAt: '2026-11-12T12:00:00Z',
  };
  await hook.rerender({ requests: [approved, rejectedEdit] });
  expect(hook.result.current.unread).toEqual([rejectedEdit]);
});
it('persists acknowledgement across remounts and surfaces a later decision', async () => {
  const first = await renderHook(() =>
    useReviewDecisions('owner', listings, [approved]),
  );
  await waitFor(() => expect(first.result.current.unread).toHaveLength(1));
  await act(() => first.result.current.acknowledge(approved));
  await waitFor(async () =>
    expect(
      JSON.parse((await AsyncStorage.getItem(reviewSeenStorageKey('owner')))!),
    ).toContain(reviewDecisionKey(approved)),
  );
  expect(first.result.current.unread).toEqual([]);
  await first.unmount();
  const next = await renderHook(
    ({ requests }: { requests: ServiceRequest[] }) =>
      useReviewDecisions('owner', listings, requests),
    { initialProps: { requests: [approved] } },
  );
  await waitFor(() => expect(next.result.current.unread).toEqual([]));
  const later = {
    ...approved,
    id: 'later',
    reviewedAt: '2026-11-12T12:00:00Z',
  };
  await next.rerender({ requests: [approved, later] });
  await waitFor(() => expect(next.result.current.unread).toEqual([later]));
});
it('isolates seen state between accounts and does not leak the prior account during storage loading', async () => {
  await AsyncStorage.setItem(
    reviewSeenStorageKey('owner'),
    JSON.stringify([reviewDecisionKey(approved)]),
  );
  const other = { ...approved, id: 'other-review', ownerId: 'other' };
  const allListings = [...listings, { ...listings[0], ownerId: 'other' }];
  const hook = await renderHook(
    ({ uid }: { uid: string | null }) =>
      useReviewDecisions(uid, allListings, [approved, other]),
    { initialProps: { uid: 'owner' as string | null } },
  );
  await waitFor(() =>
    expect(jest.mocked(AsyncStorage.getItem)).toHaveBeenCalledWith(
      reviewSeenStorageKey('owner'),
    ),
  );
  await hook.rerender({ uid: 'other' });
  await waitFor(() => expect(hook.result.current.unread).toEqual([other]));
  await hook.rerender({ uid: null });
  expect(hook.result.current.unread).toEqual([]);
});
it('serializes rapid acknowledgements and reports storage failures without exposing another account', async () => {
  const second = { ...approved, id: 'second', providerId: 'second-service' };
  const hook = await renderHook(() =>
    useReviewDecisions(
      'owner',
      [...listings, { ...listings[0], id: 'second-service' }],
      [approved, second],
    ),
  );
  await waitFor(() => expect(hook.result.current.unread).toHaveLength(2));
  await act(() => {
    hook.result.current.acknowledge(approved);
    hook.result.current.acknowledge(second);
  });
  await waitFor(async () =>
    expect(
      JSON.parse((await AsyncStorage.getItem(reviewSeenStorageKey('owner')))!),
    ).toHaveLength(2),
  );
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('Storage full'));
  await act(() =>
    hook.result.current.acknowledge({ ...approved, id: 'third' }),
  );
  await waitFor(() =>
    expect(hook.result.current.persistenceError).toContain('تعذر حفظ'),
  );
});

it('surfaces independent photo review decisions before and after text moderation without altering non-photo keys', async () => {
  expect(reviewDecisionKey(approved)).toBe(
    JSON.stringify(['request', 'approved', '2026-11-11T10:00:00Z']),
  );
  const photoApprovedWhileTextPending: ServiceRequest = {
    ...approved,
    id: 'photo-first',
    status: 'pending',
    reviewedAt: undefined,
    photoReviewStatus: 'approved',
    photoReviewedAt: '2026-11-13T10:00:00Z',
  };
  const hook = await renderHook(
    ({ requests }: { requests: ServiceRequest[] }) =>
      useReviewDecisions('owner', listings, requests),
    { initialProps: { requests: [photoApprovedWhileTextPending] } },
  );
  await waitFor(() =>
    expect(hook.result.current.unread).toEqual([photoApprovedWhileTextPending]),
  );
  await act(() =>
    hook.result.current.acknowledge(photoApprovedWhileTextPending),
  );
  expect(hook.result.current.unread).toEqual([]);

  const photoRejectedAfterTextApproved: ServiceRequest = {
    ...approved,
    id: 'text-first',
    photoReviewStatus: 'rejected',
    photoReviewReason: 'الصورة غير واضحة',
    photoReviewedAt: '2026-11-14T10:00:00Z',
  };
  await hook.rerender({ requests: [photoRejectedAfterTextApproved] });
  await waitFor(() =>
    expect(hook.result.current.unread).toEqual([
      photoRejectedAfterTextApproved,
    ]),
  );
});
