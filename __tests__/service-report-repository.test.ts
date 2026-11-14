import { beforeEach, expect, it, jest } from '@jest/globals';
import type { Firestore } from '@firebase/firestore';
import { submitServiceReport } from '../src/features/reports/firebaseReports';
const mockRead = jest.fn<() => Promise<{ exists: () => boolean }>>();
const mockAdd = jest.fn<(...args: unknown[]) => Promise<{ id: string }>>();
jest.mock('@firebase/firestore', () => ({
  doc: (_db: unknown, collection: string, id: string) => `${collection}/${id}`,
  collection: (_db: unknown, name: string) => name,
  getDocFromServer: () => mockRead(),
  addDoc: (...args: unknown[]) => mockAdd(...args),
  serverTimestamp: () => 'server-time',
}));
const db = {} as Firestore;
beforeEach(() => {
  jest.clearAllMocks();
  mockRead.mockResolvedValue({ exists: () => true });
  mockAdd.mockResolvedValue({ id: 'report-1' });
});
it('saves only the existing rules-compatible report fields after checking the service', async () => {
  expect(
    await submitServiceReport(db, 'user-1', 'provider-1', '  رقم غير صحيح  '),
  ).toBe('report-1');
  expect(mockAdd).toHaveBeenCalledWith('reports', {
    reporterId: 'user-1',
    providerId: 'provider-1',
    reason: 'رقم غير صحيح',
    createdAt: 'server-time',
  });
});
it.each(['', '  ', 'x'.repeat(1001)])(
  'rejects invalid reasons before database access',
  async (reason) => {
    await expect(
      submitServiceReport(db, 'user-1', 'provider-1', reason),
    ).rejects.toThrow('سبب البلاغ');
    expect(mockRead).not.toHaveBeenCalled();
    expect(mockAdd).not.toHaveBeenCalled();
  },
);
it('blocks reporting an unavailable service', async () => {
  mockRead.mockResolvedValue({ exists: () => false });
  await expect(
    submitServiceReport(db, 'user-1', 'provider-1', 'خطأ في البيانات'),
  ).rejects.toThrow('مبقتش متاحة');
  expect(mockAdd).not.toHaveBeenCalled();
});
it('never confirms a write rejected by Firebase', async () => {
  mockAdd.mockRejectedValue(new Error('Permission denied'));
  await expect(
    submitServiceReport(db, 'user-1', 'provider-1', 'خطأ في البيانات'),
  ).rejects.toThrow('Permission denied');
});

it.each([
  ['', 'provider-1'],
  ['user-1', '../provider'],
])(
  'rejects invalid identity or service ID before database access',
  async (uid, providerId) => {
    await expect(
      submitServiceReport(db, uid, providerId, 'بيانات غير صحيحة'),
    ).rejects.toThrow();
    expect(mockRead).not.toHaveBeenCalled();
    expect(mockAdd).not.toHaveBeenCalled();
  },
);
