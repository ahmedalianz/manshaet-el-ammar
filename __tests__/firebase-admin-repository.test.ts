import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Firestore } from '@firebase/firestore';
import {
  reviewRequest,
  unpublishProvider,
  restoreProvider,
  deleteProvider,
  resolveReport,
} from '../src/features/provider/firebaseAdminRepository';
const mockData = new Map<string, Record<string, unknown>>();
const mockRequestIds: string[] = [];
const mockWrites: {
  path: string;
  data?: Record<string, unknown>;
  kind: string;
}[] = [];
jest.mock('@firebase/firestore', () => ({
  doc: (_db: unknown, collection: string, id: string) => ({
    path: `${collection}/${id}`,
  }),
  collection: (_db: unknown, name: string) => name,
  query: (...args: unknown[]) => args,
  where: (...args: unknown[]) => args,
  limit: (value: number) => value,
  getDocsFromServer: async () => ({
    size: mockRequestIds.length,
    docs: mockRequestIds.map((id) => ({
      id,
      ref: { path: `serviceRequests/${id}` },
    })),
  }),
  serverTimestamp: () => 'server-time',
  runTransaction: async (
    _db: unknown,
    callback: (transaction: unknown) => Promise<void>,
  ) =>
    callback({
      get: async ({ path }: { path: string }) => {
        if (mockWrites.length) throw new Error('Read after write');
        return {
          exists: () => mockData.has(path),
          data: () => mockData.get(path) ?? {},
        };
      },
      set: ({ path }: { path: string }, data: Record<string, unknown>) =>
        mockWrites.push({ path, data, kind: 'set' }),
      update: ({ path }: { path: string }, data: Record<string, unknown>) =>
        mockWrites.push({ path, data, kind: 'update' }),
      delete: ({ path }: { path: string }) =>
        mockWrites.push({ path, kind: 'delete' }),
    }),
}));
const db = {} as Firestore;
const values = {
  displayName: 'أحمد',
  categoryId: 'plumbing',
  serviceTitle: 'سباك',
  description: '',
  phone: '01012345678',

  address: 'شارع المدارس',
  privateSecret: 'never public',
};
beforeEach(() => {
  mockData.clear();
  mockRequestIds.length = 0;
  mockWrites.length = 0;
  mockData.set('serviceRequests/r1', {
    ownerId: 'owner',
    providerId: 'p1',
    type: 'create',
    status: 'pending',
    consent: true,
    proposedData: values,
  });
  mockData.set('requestSlots/p1', { ownerId: 'owner', requestId: 'r1' });
  mockData.set('categories/plumbing', { active: true });
});
describe('atomic Firebase moderation', () => {
  it('publishes approved fields and review together without exposing private fields', async () => {
    await reviewRequest(db, 'admin', 'r1', 'approved');
    expect(mockWrites).toHaveLength(2);
    expect(mockWrites[0]).toMatchObject({
      path: 'providers/p1',
      data: {
        ownerId: 'owner',
        displayName: 'أحمد',
        publishedAt: 'server-time',
      },
    });
    expect(mockWrites[0].data).not.toHaveProperty('privateSecret');
    expect(mockWrites[0].data).not.toHaveProperty('reviewedBy');
    expect(mockWrites[1]).toMatchObject({
      path: 'serviceRequests/r1',
      data: { status: 'approved', reviewedBy: 'admin' },
    });
  });
  it('rejects with reason without changing the public service', async () => {
    await reviewRequest(db, 'admin', 'r1', 'rejected', ' صحح الرقم ');
    expect(mockWrites).toEqual([
      {
        path: 'serviceRequests/r1',
        kind: 'update',
        data: {
          status: 'rejected',
          rejectionReason: 'صحح الرقم',
          reviewedBy: 'admin',
          reviewedAt: 'server-time',
          updatedAt: 'server-time',
        },
      },
    ]);
  });
  it.each(['approved', 'rejected'] as const)(
    'blocks already reviewed %s requests',
    async (decision) => {
      mockData.get('serviceRequests/r1')!.status = 'approved';
      await expect(
        reviewRequest(db, 'admin', 'r1', decision, 'سبب'),
      ).rejects.toThrow('اتراجع');
      expect(mockWrites).toHaveLength(0);
    },
  );
  it('blocks stale slots, missing consent and inactive categories', async () => {
    mockData.get('requestSlots/p1')!.requestId = 'other';
    await expect(reviewRequest(db, 'admin', 'r1', 'approved')).rejects.toThrow(
      'أحدث',
    );
    mockData.get('requestSlots/p1')!.requestId = 'r1';
    mockData.get('serviceRequests/r1')!.consent = false;
    await expect(reviewRequest(db, 'admin', 'r1', 'approved')).rejects.toThrow(
      'موافقة',
    );
    mockData.get('serviceRequests/r1')!.consent = true;
    mockData.get('categories/plumbing')!.active = false;
    await expect(reviewRequest(db, 'admin', 'r1', 'approved')).rejects.toThrow(
      'قسم',
    );
    expect(mockWrites).toHaveLength(0);
  });
  it('does not resurrect an unpublished service through a pending update', async () => {
    mockData.get('serviceRequests/r1')!.type = 'update';
    await expect(reviewRequest(db, 'admin', 'r1', 'approved')).rejects.toThrow(
      'حالة',
    );
    expect(mockWrites).toHaveLength(0);
  });
  it('updates the public projection while retaining original publication time', async () => {
    mockData.get('serviceRequests/r1')!.type = 'update';
    mockData.set('providers/p1', {
      ownerId: 'owner',
      publishedAt: 'original-time',
    });
    await reviewRequest(db, 'admin', 'r1', 'approved');
    expect(mockWrites[0].data?.publishedAt).toBe('original-time');
  });
  it('unpublishes and retains an archive record', async () => {
    mockData.set('providers/p1', {
      ...values,
      ownerId: 'owner',
      publishedAt: 'old-time',
    });
    await unpublishProvider(db, 'admin', 'p1', 'راجع العنوان');
    expect(mockWrites).toContainEqual({ path: 'providers/p1', kind: 'delete' });
    expect(
      mockWrites.some((write) => write.path === 'archivedProviders/p1'),
    ).toBe(true);
  });
  it('closes reports without changing publication', async () => {
    mockData.set('reports/report1', {});
    await resolveReport(db, 'admin', 'report1');
    expect(mockWrites).toEqual([
      {
        path: 'reports/report1',
        kind: 'update',
        data: { status: 'closed', closedAt: 'server-time', closedBy: 'admin' },
      },
    ]);
  });
});

it('releases a pending new-service reservation when rejected', async () => {
  mockData.set('serviceQuotas/owner', { serviceIds: ['p1', 'other'] });
  await reviewRequest(db, 'admin', 'r1', 'rejected', 'سبب الرفض');
  expect(mockWrites).toContainEqual({
    path: 'serviceQuotas/owner',
    kind: 'update',
    data: { serviceIds: ['other'], updatedAt: 'server-time' },
  });
});
it('releases a published-service reservation when unpublished', async () => {
  mockData.set('providers/p1', {
    ...values,
    ownerId: 'owner',
    publishedAt: 'old-time',
  });
  mockData.set('serviceQuotas/owner', { serviceIds: ['p1', 'other'] });
  await unpublishProvider(db, 'admin', 'p1', 'راجع العنوان');
  expect(mockWrites).toContainEqual({
    path: 'serviceQuotas/owner',
    kind: 'update',
    data: { serviceIds: ['other'], updatedAt: 'server-time' },
  });
});

it('permanently deletes the public service, slot and all submissions while releasing quota', async () => {
  mockRequestIds.push('r1', 'r2');
  mockData.set('providers/p1', { ownerId: 'owner' });
  mockData.set('serviceRequests/r2', {
    ownerId: 'owner',
    providerId: 'p1',
    status: 'approved',
  });
  mockData.set('serviceQuotas/owner', {
    serviceIds: ['p1', 'other'],
    limit: 3,
  });
  await deleteProvider(db, 'p1');
  expect(mockWrites).toEqual([
    {
      path: 'serviceQuotas/owner',
      kind: 'update',
      data: { serviceIds: ['other'], updatedAt: 'server-time' },
    },
    { path: 'serviceRequests/r1', kind: 'delete' },
    { path: 'serviceRequests/r2', kind: 'delete' },
    { path: 'requestSlots/p1', kind: 'delete' },
    { path: 'providers/p1', kind: 'delete' },
  ]);
});
it('deletes an already unpublished service through its retained slot and history', async () => {
  mockRequestIds.push('r1');
  await deleteProvider(db, 'p1');
  expect(mockWrites).toContainEqual({
    path: 'serviceRequests/r1',
    kind: 'delete',
  });
});
it('aborts deletion if a new submission appeared after loading history', async () => {
  mockRequestIds.push('older-request');
  await expect(deleteProvider(db, 'p1')).rejects.toThrow('وصل طلب جديد');
  expect(mockWrites).toHaveLength(0);
});
it('does not partially delete oversized service histories', async () => {
  mockRequestIds.push(
    ...Array.from({ length: 401 }, (_, index) => String(index)),
  );
  await expect(deleteProvider(db, 'p1')).rejects.toThrow('سجل كبير');
  expect(mockWrites).toHaveLength(0);
});

describe('unpublished recovery', () => {
  it('requires a reason before reading or writing', async () => {
    await expect(unpublishProvider(db, 'admin', 'p1', '   ')).rejects.toThrow(
      'سبب',
    );
    expect(mockWrites).toHaveLength(0);
  });
  it('archives the last published version with reason and rejects an in-flight edit atomically', async () => {
    mockData.set('providers/p1', {
      ...values,
      ownerId: 'owner',
      publishedAt: 'old-time',
    });
    mockData.set('serviceQuotas/owner', { serviceIds: ['p1'] });
    await unpublishProvider(db, 'admin', 'p1', ' راجع العنوان ');
    expect(mockWrites).toContainEqual(
      expect.objectContaining({
        path: 'archivedProviders/p1',
        kind: 'set',
        data: expect.objectContaining({
          ownerId: 'owner',
          unpublishReason: 'راجع العنوان',
          unpublishedBy: 'admin',
          archiveStatus: 'unpublished',
        }),
      }),
    );
    expect(mockWrites).toContainEqual(
      expect.objectContaining({
        path: 'serviceRequests/r1',
        data: expect.objectContaining({
          status: 'rejected',
          rejectionReason: 'راجع العنوان',
        }),
      }),
    );
    expect(mockWrites).toContainEqual({ path: 'providers/p1', kind: 'delete' });
  });
  it('restores explicitly with stable owner/id and no private archive metadata in public', async () => {
    mockData.set('archivedProviders/p1', {
      ...values,
      ownerId: 'owner',
      archiveStatus: 'unpublished',
      unpublishReason: 'راجع العنوان',
    });
    mockData.get('serviceRequests/r1')!.status = 'rejected';
    await restoreProvider(db, 'admin', 'p1');
    const publication = mockWrites.find(
      (write) => write.path === 'providers/p1',
    )!;
    expect(publication.data).toMatchObject({
      ownerId: 'owner',
      phone: values.phone,
    });
    expect(publication.data).not.toHaveProperty('unpublishReason');
    expect(publication.data).not.toHaveProperty('privateSecret');
    expect(mockWrites).toContainEqual(
      expect.objectContaining({
        path: 'archivedProviders/p1',
        data: expect.objectContaining({
          archiveStatus: 'restored',
          restoredBy: 'admin',
        }),
      }),
    );
  });
  it('blocks direct restore while a correction is waiting, and approves that correction instead', async () => {
    mockData.set('archivedProviders/p1', {
      ...values,
      ownerId: 'owner',
      archiveStatus: 'unpublished',
      unpublishReason: 'راجع العنوان',
    });
    mockData.get('serviceRequests/r1')!.type = 'restore';
    await expect(restoreProvider(db, 'admin', 'p1')).rejects.toThrow('مراجعة');
    expect(mockWrites).toHaveLength(0);
    await reviewRequest(db, 'admin', 'r1', 'approved');
    expect(mockWrites).toContainEqual(
      expect.objectContaining({
        path: 'providers/p1',
        data: expect.objectContaining({ ownerId: 'owner' }),
      }),
    );
  });
});

it('refuses restore after publication or when the owner quota is full', async () => {
  mockData.set('archivedProviders/p1', {
    ...values,
    ownerId: 'owner',
    archiveStatus: 'unpublished',
  });
  mockData.get('serviceRequests/r1')!.status = 'rejected';
  mockData.set('serviceQuotas/owner', { serviceIds: ['a', 'b', 'c'] });
  await expect(restoreProvider(db, 'admin', 'p1')).rejects.toThrow(
    'تواصل مع الدعم',
  );
  expect(mockWrites).toHaveLength(0);
  mockData.set('providers/p1', { ownerId: 'owner' });
  await expect(restoreProvider(db, 'admin', 'p1')).rejects.toThrow('الأرشيف');
});
it('keeps rejected corrections in history and the archive private without publishing', async () => {
  mockData.get('serviceRequests/r1')!.type = 'restore';
  mockData.set('archivedProviders/p1', {
    ...values,
    ownerId: 'owner',
    archiveStatus: 'unpublished',
  });
  mockData.set('serviceQuotas/owner', { serviceIds: ['p1', 'other'] });
  await reviewRequest(db, 'admin', 'r1', 'rejected', 'وضّح العنوان');
  expect(
    mockWrites.some(
      (write) =>
        write.path === 'providers/p1' || write.path === 'archivedProviders/p1',
    ),
  ).toBe(false);
  expect(mockWrites).toContainEqual(
    expect.objectContaining({
      path: 'serviceQuotas/owner',
      data: expect.objectContaining({ serviceIds: ['other'] }),
    }),
  );
});
