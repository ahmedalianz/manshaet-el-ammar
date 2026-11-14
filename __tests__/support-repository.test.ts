import { beforeEach, expect, it, jest } from '@jest/globals';
import type { Firestore } from '@firebase/firestore';
import {
  submitSupportRequest,
  reviewSupportRequest,
  nextStatuses,
} from '../src/features/support/requests';
let mockCurrent: Record<string, unknown> | null;
const mockSet = jest.fn(),
  mockUpdate = jest.fn();
jest.mock('@firebase/firestore', () => ({
  doc: (_db: unknown, _c: string, id: string) => ({ id }),
  serverTimestamp: () => 'server-time',
  runTransaction: async (
    _db: unknown,
    callback: (transaction: unknown) => Promise<void>,
  ) =>
    callback({
      get: async () => ({
        exists: () => Boolean(mockCurrent),
        data: () => mockCurrent,
      }),
      set: mockSet,
      update: mockUpdate,
    }),
}));
const db = {} as Firestore;
beforeEach(() => {
  mockCurrent = null;
  jest.clearAllMocks();
});
it('creates private received requests and handles retries without duplicate writes', async () => {
  await submitSupportRequest(db, 'ticket', 'owner', 'support', ' مساعدة ');
  expect(mockSet).toHaveBeenCalledWith(
    { id: 'ticket' },
    expect.objectContaining({
      ownerId: 'owner',
      message: 'مساعدة',
      status: 'received',
    }),
  );
  mockCurrent = { ownerId: 'owner', kind: 'support', message: 'مساعدة' };
  mockSet.mockClear();
  await submitSupportRequest(db, 'ticket', 'owner', 'support', 'مساعدة');
  expect(mockSet).not.toHaveBeenCalled();
  await expect(
    submitSupportRequest(db, 'ticket', 'owner', 'support', 'مختلف'),
  ).rejects.toThrow('مستخدم');
});
it('never submits a deletion request without explicit consent', async () => {
  await expect(
    submitSupportRequest(db, 'ticket', 'owner', 'deletion', 'حذف'),
  ).rejects.toThrow('توافق');
  expect(mockSet).not.toHaveBeenCalled();
  await submitSupportRequest(db, 'ticket', 'owner', 'deletion', 'حذف', true);
  expect(mockSet).toHaveBeenCalledWith(
    { id: 'ticket' },
    expect.objectContaining({ consent: true, consentedAt: 'server-time' }),
  );
});
it('requires a rejection reason and validates transitions against current state', async () => {
  mockCurrent = { kind: 'support', status: 'received' };
  await expect(
    reviewSupportRequest(db, 'ticket', 'rejected', ''),
  ).rejects.toThrow('الرفض');
  await expect(
    reviewSupportRequest(db, 'ticket', 'resolved', ''),
  ).rejects.toThrow('اتغيرت');
  expect(mockUpdate).not.toHaveBeenCalled();
  await reviewSupportRequest(db, 'ticket', 'in_review', 'بنراجع طلبك');
  expect(mockUpdate).toHaveBeenCalledWith(
    { id: 'ticket' },
    expect.objectContaining({ status: 'in_review', staffNote: 'بنراجع طلبك' }),
  );
  expect(nextStatuses('deletion', 'awaiting_verification')).toEqual([
    'ready_for_deletion',
    'rejected',
  ]);
  expect(nextStatuses('deletion', 'ready_for_deletion')).toEqual([]);
});
