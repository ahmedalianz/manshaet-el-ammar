import { beforeEach, expect, it, jest } from '@jest/globals';
import type { Firestore } from '@firebase/firestore';
import { confirmProviderDetails } from '../src/features/provider/confirmation';
const stamp = { toDate: () => new Date('2026-11-12T12:00:00Z') };
let mockRecord: Record<string, unknown> | null;
const mockUpdate = jest.fn();
jest.mock('@firebase/firestore', () => ({
  doc: (_db: unknown, _collection: string, id: string) => ({ id }),
  serverTimestamp: () => 'now',
  runTransaction: async (
    _db: unknown,
    callback: (t: unknown) => Promise<void>,
  ) =>
    callback({
      get: async () => ({
        exists: () => Boolean(mockRecord),
        data: () => mockRecord,
      }),
      update: mockUpdate,
    }),
}));
beforeEach(() => {
  mockUpdate.mockClear();
  mockRecord = { ownerId: 'owner', updatedAt: stamp };
});
it('confirms only the displayed public revision, touching no editable fields', async () => {
  await confirmProviderDetails(
    {} as Firestore,
    'owner',
    'p',
    '2026-11-12T12:00:00.000Z',
  );
  expect(mockUpdate).toHaveBeenCalledWith(
    { id: 'p' },
    { lastConfirmedAt: 'now' },
  );
});
it('refuses another owner and stale displayed data', async () => {
  await expect(
    confirmProviderDetails(
      {} as Firestore,
      'foreign',
      'p',
      '2026-11-12T12:00:00.000Z',
    ),
  ).rejects.toThrow('حسابك');
  await expect(
    confirmProviderDetails({} as Firestore, 'owner', 'p', 'old'),
  ).rejects.toThrow('اتغيرت');
  expect(mockUpdate).not.toHaveBeenCalled();
});
it('never confirms an unavailable service', async () => {
  mockRecord = null;
  await expect(
    confirmProviderDetails({} as Firestore, 'owner', 'p', 'old'),
  ).rejects.toThrow('متاحة');
  expect(mockUpdate).not.toHaveBeenCalled();
});
