import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Firestore } from '@firebase/firestore';
import { submitRequest } from '../src/features/provider/firebaseRepository';
import { toStoredValues } from '../src/features/provider/firebaseMapping';
const mockData = new Map<string, Record<string, unknown>>();
const mockWrites: { path: string; data: Record<string, unknown> }[] = [];
const mockReads: string[] = [];
jest.mock('@firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => ({ path }),
  doc: (_db: unknown, ...parts: string[]) => ({
    path: parts.join('/'),
    id: parts.at(-1),
  }),
  serverTimestamp: () => 'server-time',
  runTransaction: async (
    _db: unknown,
    callback: (transaction: {
      get: (reference: { path: string }) => Promise<{
        exists: () => boolean;
        data: () => Record<string, unknown>;
      }>;
      set: (reference: { path: string }, data: Record<string, unknown>) => void;
    }) => Promise<unknown>,
  ) =>
    callback({
      get: async (reference) => {
        if (mockWrites.length) throw new Error('Read after write');
        mockReads.push(reference.path);
        return {
          exists: () => mockData.has(reference.path),
          data: () => mockData.get(reference.path) ?? {},
        };
      },
      set: (reference, data) => {
        mockWrites.push({ path: reference.path, data });
      },
    }),
}));
const db = {} as Firestore;
const values = {
  serviceMode: 'fixed' as const,
  name: 'أحمد',
  categoryId: 'plumbing',
  serviceTitle: 'سباك',
  description: '',
  phone: '01012345678',

  address: 'شارع المدرسة',
};
beforeEach(() => {
  mockData.clear();
  mockWrites.length = 0;
  mockReads.length = 0;
  mockData.set('categories/plumbing', { active: true });
});
describe('Firestore request transaction', () => {
  it('writes all validation receipts and matching slot hours atomically with a weekly proposal', async () => {
    const proposal = {
      ...values,
      weeklyHours: {
        sat: {
          status: 'open' as const,
          periods: [{ start: '22:00', end: '02:00', overnight: true }],
        },
      },
    };
    await submitRequest(
      db,
      'owner',
      proposal,
      undefined,
      'hours-request',
      true,
    );
    expect(
      mockWrites
        .filter((write) => write.path.includes('/scheduleValidation/'))
        .map((write) => write.path),
    ).toEqual(
      ['0', '1', '2', '3'].map(
        (chunk) => `serviceRequests/hours-request/scheduleValidation/${chunk}`,
      ),
    );
    const stored = toStoredValues(proposal);
    expect(
      mockWrites.find((write) => write.path.startsWith('requestSlots/'))?.data
        .weeklyHours,
    ).toEqual(stored.weeklyHours);
  });
  it('requires explicit consent before any remote read', async () => {
    await expect(
      submitRequest(db, 'owner', values, undefined, 'r1'),
    ).rejects.toThrow('توافق');
    expect(mockReads).toHaveLength(0);
  });
  it('writes a pending request and slot after all reads, never a provider', async () => {
    await expect(
      submitRequest(db, 'owner', values, undefined, 'r1', true),
    ).resolves.toBe('provider-r1');
    expect(mockWrites.map((write) => write.path)).toEqual([
      'serviceRequests/r1',
      'requestSlots/provider-r1',
    ]);
    expect(mockWrites[0].data).toMatchObject({
      status: 'pending',
      consent: true,
      type: 'create',
      providerId: 'provider-r1',
      proposedData: toStoredValues(values),
    });
  });
  it('acknowledges an identical retry without writing', async () => {
    mockData.set('serviceRequests/r1', {
      ownerId: 'owner',
      providerId: 'provider-r1',
      proposedData: toStoredValues(values),
    });
    await expect(
      submitRequest(db, 'owner', values, undefined, 'r1', true),
    ).resolves.toBe('provider-r1');
    expect(mockWrites).toHaveLength(0);
  });
  it('rejects a reused request identifier with changed data', async () => {
    mockData.set('serviceRequests/r1', {
      ownerId: 'owner',
      providerId: 'provider-r1',
      proposedData: toStoredValues({ ...values, serviceTitle: 'مختلف' }),
    });
    await expect(
      submitRequest(db, 'owner', values, undefined, 'r1', true),
    ).rejects.toThrow('طلب مختلف');
    expect(mockWrites).toHaveLength(0);
  });
  it('blocks a second pending request and preserves the published provider', async () => {
    mockData.set('providers/p', { ownerId: 'owner' });
    mockData.set('requestSlots/p', { ownerId: 'owner', requestId: 'old' });
    mockData.set('serviceRequests/old', {
      ownerId: 'owner',
      type: 'update',
      status: 'pending',
    });
    await expect(
      submitRequest(db, 'owner', values, 'p', 'r1', true),
    ).rejects.toThrow('مستني المراجعة');
    expect(mockWrites).toHaveLength(0);
  });
  it('resubmits rejected creates under the same provider ID without erasing history', async () => {
    mockData.set('requestSlots/p', { ownerId: 'owner', requestId: 'old' });
    mockData.set('serviceRequests/old', {
      ownerId: 'owner',
      type: 'create',
      status: 'rejected',
    });
    await expect(
      submitRequest(db, 'owner', values, 'p', 'r1', true),
    ).resolves.toBe('p');
    expect(mockWrites[0].data.type).toBe('create');
    expect(
      mockWrites.some((write) => write.path === 'serviceRequests/old'),
    ).toBe(false);
  });
  it('refuses inactive categories and foreign owners', async () => {
    mockData.set('categories/plumbing', { active: false });
    await expect(
      submitRequest(db, 'owner', values, undefined, 'r1', true),
    ).rejects.toThrow('القسم');
    mockData.set('categories/plumbing', { active: true });
    mockData.set('providers/p', { ownerId: 'foreign' });
    await expect(
      submitRequest(db, 'owner', values, 'p', 'r1', true),
    ).rejects.toThrow('لحسابك');
    expect(mockWrites).toHaveLength(0);
  });
});

it('allows submitting more than 3 new services', async () => {
  await expect(
    submitRequest(db, 'owner', values, undefined, 'r4', true),
  ).resolves.toBe('provider-r4');
});

describe('owner archive corrections', () => {
  it('submits a restore request with consent, without publishing', async () => {
    mockData.set('archivedProviders/p', {
      ownerId: 'owner',
      archiveStatus: 'unpublished',
    });
    await submitRequest(db, 'owner', values, 'p', 'correction', true);
    expect(mockWrites[0].data).toMatchObject({
      type: 'restore',
      providerId: 'p',
      ownerId: 'owner',
      status: 'pending',
    });
    expect(mockWrites.some((write) => write.path === 'providers/p')).toBe(
      false,
    );
  });
  it('rejects a correction for somebody else’s archive', async () => {
    mockData.set('archivedProviders/p', {
      ownerId: 'foreign',
      archiveStatus: 'unpublished',
    });
    await expect(
      submitRequest(db, 'owner', values, 'p', 'correction', true),
    ).rejects.toThrow('لحسابك');
    expect(mockWrites).toHaveLength(0);
  });
});
