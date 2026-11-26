import { beforeEach, expect, it, jest } from '@jest/globals';
import type { Firestore } from '@firebase/firestore';
import {
  submitSupportRequest,
  reviewSupportRequest,
  nextStatuses,
  fetchSupportRequest,
  fetchSupportRequests,
} from '../src/features/support/requests';
let mockCurrent: Record<string, unknown> | null;
let mockDocs: { id: string; data: () => Record<string, unknown> }[] = [];
const mockSet = jest.fn(),
  mockUpdate = jest.fn();
jest.mock('@firebase/firestore', () => ({
  collection: jest.fn(() => ({})),
  doc: (_db: unknown, _c: string, id: string) => ({ id }),
  getDocFromServer: jest.fn(async () => ({
    exists: () => Boolean(mockCurrent),
    id: 'ticket',
    data: () => mockCurrent,
  })),
  getDocsFromServer: jest.fn(async () => ({
    docs: mockDocs,
  })),
  limit: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
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
  mockDocs = [];
  jest.clearAllMocks();
});
it('creates private received support requests and handles retries without duplicate writes', async () => {
  await submitSupportRequest(db, 'ticket', 'owner', ' مساعدة ');
  expect(mockSet).toHaveBeenCalledWith(
    { id: 'ticket' },
    expect.objectContaining({
      ownerId: 'owner',
      kind: 'support',
      message: 'مساعدة',
      status: 'received',
    }),
  );
  mockCurrent = { ownerId: 'owner', kind: 'support', message: 'مساعدة' };
  mockSet.mockClear();
  await submitSupportRequest(db, 'ticket', 'owner', 'مساعدة');
  expect(mockSet).not.toHaveBeenCalled();
  await expect(
    submitSupportRequest(db, 'ticket', 'owner', 'مختلف'),
  ).rejects.toThrow('مستخدم');
});
it('requires a rejection reason and validates support transitions against current state', async () => {
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
  expect(nextStatuses('received')).toEqual(['in_review', 'rejected']);
  expect(nextStatuses('in_review')).toEqual(['resolved', 'rejected']);
  expect(nextStatuses('resolved')).toEqual([]);
  expect(nextStatuses('rejected')).toEqual([]);
});
it('ignores or rejects legacy non-support records cleanly', async () => {
  mockDocs = [
    {
      id: 'legacy-del',
      data: () => ({
        ownerId: 'owner',
        kind: 'deletion',
        message: 'حذف',
        status: 'received',
      }),
    },
    {
      id: 'sup-1',
      data: () => ({
        ownerId: 'owner',
        kind: 'support',
        message: 'مساعدة',
        status: 'received',
        createdAt: { toDate: () => new Date('2026-11-10T10:00:00Z') },
        updatedAt: { toDate: () => new Date('2026-11-10T10:00:00Z') },
      }),
    },
  ];
  const list = await fetchSupportRequests(db, 'owner');
  expect(list.map((item) => item.id)).toEqual(['sup-1']);

  mockCurrent = { kind: 'deletion', status: 'received' };
  await expect(fetchSupportRequest(db, 'ticket')).rejects.toThrow('غير موجود');
  await expect(
    reviewSupportRequest(db, 'ticket', 'in_review', ''),
  ).rejects.toThrow('اتغيرت');
  expect(mockUpdate).not.toHaveBeenCalled();
});
