import { beforeEach, expect, it, jest } from '@jest/globals';
import type { Firestore } from '@firebase/firestore';
import {
  fetchCategoryProviders,
  fetchPublicProviders,
  fetchProviderTotal,
} from '../src/features/provider/firebaseRepository';
const mockRead =
  jest.fn<
    (q: unknown) => Promise<{ docs: { id: string; data: () => object }[] }>
  >();
const mockCount =
  jest.fn<(q: unknown) => Promise<{ data: () => { count: number } }>>();
jest.mock('../src/features/provider/firebaseMapping', () => ({
  mapProvider: (id: string) => ({ id }),
}));
jest.mock('@firebase/firestore', () => ({
  collection: (_: unknown, path: string) => ({ path }),
  query: (base: unknown, ...constraints: unknown[]) => ({ base, constraints }),
  where: (...args: unknown[]) => ({ where: args }),
  orderBy: (...args: unknown[]) => ({ order: args }),
  documentId: () => '__name__',
  limit: (size: number) => ({ limit: size }),
  startAfter: (snapshot: unknown) => ({ startAfter: snapshot }),
  getDocsFromServer: (q: unknown) => mockRead(q),
  getCountFromServer: (q: unknown) => mockCount(q),
}));
const db = {} as Firestore;
const documents = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `same-date-${i}`,
    data: () => ({ publishedAt: 'same-timestamp' }),
  }));
beforeEach(() => {
  jest.clearAllMocks();
});
it('uses the last document snapshot, including its ID, as the cursor for equal timestamps', async () => {
  const docs = documents(100);
  mockRead.mockResolvedValueOnce({ docs }).mockResolvedValueOnce({
    docs: [{ id: 'older-service', data: () => ({}) }],
  });
  const first = await fetchPublicProviders(db);
  expect(first.nextCursor).toBe(docs[99]);
  const second = await fetchPublicProviders(db, first.nextCursor);
  expect(mockRead.mock.calls[1][0]).toMatchObject({
    constraints: [{ startAfter: docs[99] }, { limit: 100 }],
  });
  expect(second.items.map((item) => item.id)).toEqual(['older-service']);
  expect(second.nextCursor).toBeUndefined();
  expect(mockRead.mock.calls[0][0]).toMatchObject({
    base: {
      constraints: [
        { order: ['publishedAt', 'desc'] },
        { order: ['__name__', 'desc'] },
      ],
    },
  });
});
it('keeps the category predicate on every 50-record page and terminates an exact page boundary', async () => {
  const docs = documents(50);
  mockRead.mockResolvedValueOnce({ docs }).mockResolvedValueOnce({ docs: [] });
  const first = await fetchCategoryProviders(db, 'plumbing');
  const last = await fetchCategoryProviders(db, 'plumbing', first.nextCursor);
  expect(mockRead.mock.calls[1][0]).toMatchObject({
    base: {
      constraints: [
        { where: ['categoryId', '==', 'plumbing'] },
        { order: ['publishedAt', 'desc'] },
        { order: ['__name__', 'desc'] },
      ],
    },
    constraints: [{ startAfter: docs[49] }, { limit: 50 }],
  });
  expect(last.items).toEqual([]);
  expect(last.nextCursor).toBeUndefined();
});
it('counts the same query without a page limit or cursor', async () => {
  mockCount.mockResolvedValue({ data: () => ({ count: 205 }) });
  expect(await fetchProviderTotal(db, 'plumbing')).toBe(205);
  expect(mockCount.mock.calls[0][0]).toMatchObject({
    constraints: [
      { where: ['categoryId', '==', 'plumbing'] },
      { order: ['publishedAt', 'desc'] },
      { order: ['__name__', 'desc'] },
    ],
  });
});
