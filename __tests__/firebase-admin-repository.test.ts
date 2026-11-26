import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Firestore } from '@firebase/firestore';
import {
  fetchAdminService,
  hasRecoverableServicePhoto,
  retryRestoreServicePhoto,
  reviewRequest,
  saveAdminProvider,
  unpublishProvider,
  restoreProvider,
  deleteProvider,
  resolveReport,
} from '../src/features/provider/firebaseAdminRepository';
import * as photoApi from '../src/features/photos/api';
const mockData = new Map<string, Record<string, unknown>>();
const mockRequestIds: string[] = [];
const mockWrites: {
  path: string;
  data?: Record<string, unknown>;
  kind: string;
}[] = [];
let mockGeneratedCounter = 0;
jest.mock('@firebase/firestore', () => ({
  doc: (dbOrCollection: unknown, collection?: string, id?: string) => {
    const resolvedId = id ?? `generated-${++mockGeneratedCounter}`;
    return {
      id: resolvedId,
      path:
        collection === undefined
          ? `${dbOrCollection}/${resolvedId}`
          : `${collection}/${resolvedId}`,
    };
  },
  collection: (_db: unknown, name: string) => name,
  query: (...args: unknown[]) => args,
  where: (...args: unknown[]) => args,
  limit: (value: number) => value,
  getDocFromServer: async ({ path }: { path: string }) => ({
    exists: () => mockData.has(path),
    id: path.split('/').at(-1),
    data: () => mockData.get(path) ?? {},
  }),
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

  address: 'شارع المدرسة',
  privateSecret: 'never public',
};
beforeEach(() => {
  mockData.clear();
  mockRequestIds.length = 0;
  mockWrites.length = 0;
  mockGeneratedCounter = 0;
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

it('permanently deletes the public service, slot and all submissions', async () => {
  mockRequestIds.push('r1', 'r2');
  mockData.set('providers/p1', { ownerId: 'owner' });
  mockData.set('serviceRequests/r2', {
    ownerId: 'owner',
    providerId: 'p1',
    status: 'approved',
  });
  await deleteProvider(db, 'p1');
  expect(mockWrites).toEqual([
    { path: 'serviceRequests/r1', kind: 'delete' },
    { path: 'serviceRequests/r2', kind: 'delete' },
    { path: 'requestSlots/p1', kind: 'delete' },
    {
      path: 'photoServiceCleanupJobs/generated-1',
      kind: 'set',
      data: {
        providerId: 'p1',
        ownerId: 'owner',
        reason: 'delete',
        state: 'pending',
        createdAt: 'server-time',
      },
    },
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

it('refuses restore after publication', async () => {
  mockData.set('archivedProviders/p1', {
    ...values,
    ownerId: 'owner',
    archiveStatus: 'unpublished',
  });
  mockData.get('serviceRequests/r1')!.status = 'rejected';
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
  await reviewRequest(db, 'admin', 'r1', 'rejected', 'وضّح العنوان');
  expect(
    mockWrites.some(
      (write) =>
        write.path === 'providers/p1' || write.path === 'archivedProviders/p1',
    ),
  ).toBe(false);
});

describe('admin unlimited creation and direct editing of any service', () => {
  const formValues = {
    name: 'أحمد',
    categoryId: 'plumbing',
    serviceTitle: 'سباك',
    description: 'وصف الخدمة',
    phone: '01012345678',
    address: 'شارع المدرسة',
    serviceMode: 'fixed' as const,
  };

  it('lets admins create more than 3 services directly', async () => {
    for (let i = 1; i <= 5; i++) {
      mockWrites.length = 0;
      const id = await saveAdminProvider(
        db,
        'admin',
        { ...formValues, serviceTitle: `سباك ${i}` },
        undefined,
        `sub-${i}`,
      );
      expect(id).toBe(`provider-sub-${i}`);
      expect(mockWrites).toEqual([
        {
          path: `providers/${id}`,
          kind: 'set',
          data: expect.objectContaining({
            ownerId: 'admin',
            serviceTitle: `سباك ${i}`,
          }),
        },
      ]);
      mockData.set(`providers/${id}`, {
        ...values,
        ownerId: 'admin',
      });
    }
  });

  it('edits a foreign published service directly while preserving owner, timestamps, location, and rejecting pending updates', async () => {
    mockData.set('providers/p1', {
      ...values,
      ownerId: 'owner',
      publishedAt: 'original-published-time',
      location: { latitude: 30.35, longitude: 31.2 },
      lastConfirmedAt: 'original-confirmed-time',
    });
    mockData.get('serviceRequests/r1')!.type = 'update';

    const savedId = await saveAdminProvider(
      db,
      'admin',
      { ...formValues, serviceTitle: 'سباك محدث' },
      'p1',
    );
    expect(savedId).toBe('p1');
    expect(mockWrites).toContainEqual({
      path: 'providers/p1',
      kind: 'set',
      data: expect.objectContaining({
        ownerId: 'owner',
        publishedAt: 'original-published-time',
        location: { latitude: 30.35, longitude: 31.2 },
        lastConfirmedAt: 'original-confirmed-time',
        serviceTitle: 'سباك محدث',
        updatedAt: 'server-time',
      }),
    });
    expect(mockWrites).toContainEqual({
      path: 'serviceRequests/r1',
      kind: 'update',
      data: expect.objectContaining({
        status: 'rejected',
        reviewedBy: 'admin',
        rejectionReason: 'تم تحديث بيانات الخدمة مباشرة بواسطة مشرف الدليل.',
      }),
    });
  });

  it('edits an unpublished foreign archive service in place', async () => {
    mockData.set('archivedProviders/p1', {
      ...values,
      ownerId: 'owner',
      publishedAt: 'original-published-time',
      archiveStatus: 'unpublished',
      unpublishReason: 'راجع العنوان',
      unpublishedAt: 'unpublished-time',
      unpublishedBy: 'admin-prev',
    });
    mockData.get('serviceRequests/r1')!.type = 'restore';

    await saveAdminProvider(
      db,
      'admin',
      { ...formValues, serviceTitle: 'تصحيح الأرشيف' },
      'p1',
    );
    expect(mockWrites).toContainEqual({
      path: 'archivedProviders/p1',
      kind: 'set',
      data: expect.objectContaining({
        ownerId: 'owner',
        publishedAt: 'original-published-time',
        archiveStatus: 'unpublished',
        unpublishReason: 'راجع العنوان',
        unpublishedAt: 'unpublished-time',
        unpublishedBy: 'admin-prev',
        serviceTitle: 'تصحيح الأرشيف',
      }),
    });
    expect(mockWrites.some((write) => write.path === 'providers/p1')).toBe(
      false,
    );
  });

  it('restores an admin-owned archived service', async () => {
    mockData.set('archivedProviders/p1', {
      ...values,
      ownerId: 'admin',
      archiveStatus: 'unpublished',
      unpublishReason: 'سبب',
    });
    mockData.get('serviceRequests/r1')!.status = 'rejected';

    await restoreProvider(db, 'admin', 'p1');
    expect(mockWrites).toContainEqual(
      expect.objectContaining({
        path: 'providers/p1',
        kind: 'set',
        data: expect.objectContaining({ ownerId: 'admin' }),
      }),
    );
  });

  it('fetches published, unpublished archived, and missing services via fetchAdminService', async () => {
    const timestamp = { toDate: () => new Date('2026-11-03T10:00:00.000Z') };
    mockData.set('providers/pub-1', {
      ...values,
      serviceMode: 'fixed',
      ownerId: 'foreign-user',
      publishedAt: timestamp,
      updatedAt: timestamp,
    });
    mockData.set('archivedProviders/arch-1', {
      ...values,
      serviceMode: 'fixed',
      ownerId: 'foreign-user',
      publishedAt: timestamp,
      archiveStatus: 'unpublished',
      unpublishReason: 'سبب الأرشيف',
      unpublishedAt: timestamp,
      unpublishedBy: 'admin',
    });

    const published = await fetchAdminService(db, 'pub-1');
    expect(published).toMatchObject({
      id: 'pub-1',
      ownerId: 'foreign-user',
      publicationStatus: 'published',
    });

    const archived = await fetchAdminService(db, 'arch-1');
    expect(archived).toMatchObject({
      id: 'arch-1',
      ownerId: 'foreign-user',
      publicationStatus: 'unpublished',
      unpublishReason: 'سبب الأرشيف',
    });

    await expect(fetchAdminService(db, 'missing-1')).resolves.toBeNull();
  });

  it('triggers server photo restoration when approving a restore request with an archived photo', async () => {
    const previousUrl = process.env.EXPO_PUBLIC_PHOTO_API_URL;
    process.env.EXPO_PUBLIC_PHOTO_API_URL = 'https://photos.example.test';
    const photoSpy = jest
      .spyOn(photoApi, 'photoRequest')
      .mockResolvedValue({ placePhoto: null });
    try {
      mockData.get('serviceRequests/r1')!.type = 'restore';
      mockData.set('archivedProviders/p1', {
        ...values,
        ownerId: 'owner',
        archiveStatus: 'unpublished',
        placePhoto: {
          version: 'v1',
          thumbnailUrl: 'https://res.cloudinary.com/sx5exugy/image/upload/t.jpg',
          detailUrl: 'https://res.cloudinary.com/sx5exugy/image/upload/d.jpg',
          width: 1280,
          height: 960,
        },
      });
      await reviewRequest(db, 'admin', 'r1', 'approved');
      expect(photoSpy).toHaveBeenCalledWith('/v1/photos/services/p1/restore', {
        method: 'POST',
      });
    } finally {
      photoSpy.mockRestore();
      if (previousUrl === undefined)
        delete process.env.EXPO_PUBLIC_PHOTO_API_URL;
      else process.env.EXPO_PUBLIC_PHOTO_API_URL = previousUrl;
    }
  });

  it('detects recoverable service photo on restored provider without placePhoto and calls restore endpoint', async () => {
    const placePhoto = {
      version: 'v1',
      thumbnailUrl: 'https://res.cloudinary.com/sx5exugy/image/upload/t.jpg',
      detailUrl: 'https://res.cloudinary.com/sx5exugy/image/upload/d.jpg',
      width: 1280,
      height: 960,
    };
    mockData.set('providers/p1', { ownerId: 'owner', displayName: 'أحمد' });
    mockData.set('archivedProviders/p1', {
      ownerId: 'owner',
      archiveStatus: 'restored',
      placePhoto,
    });
    expect(await hasRecoverableServicePhoto(db, 'p1')).toBe(true);

    mockData.set('providers/p1', {
      ownerId: 'owner',
      displayName: 'أحمد',
      placePhoto: null,
    });
    expect(await hasRecoverableServicePhoto(db, 'p1')).toBe(false);

    const previousUrl = process.env.EXPO_PUBLIC_PHOTO_API_URL;
    process.env.EXPO_PUBLIC_PHOTO_API_URL = 'https://photos.example.workers.dev';
    const photoSpy = jest
      .spyOn(photoApi, 'photoRequest')
      .mockResolvedValue({ placePhoto });
    try {
      await retryRestoreServicePhoto('p1');
      expect(photoSpy).toHaveBeenCalledWith(
        '/v1/photos/services/p1/restore',
        { method: 'POST' },
      );
    } finally {
      photoSpy.mockRestore();
      if (previousUrl === undefined)
        delete process.env.EXPO_PUBLIC_PHOTO_API_URL;
      else process.env.EXPO_PUBLIC_PHOTO_API_URL = previousUrl;
    }
  });
});
