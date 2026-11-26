import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  applyOperation,
  changedFields,
  getMyServices,
  getPublicProviders,
  initialMockState,
} from './fixtures/moderation';
import type {
  MockAccount,
  MockOperation,
  MockState,
} from '../src/features/provider/types';

describe('local moderation lifecycle', () => {
  let state: MockState;
  let owner: MockAccount;
  let admin: MockAccount;
  let sequence: number;
  const now = '2026-11-04T12:00:00.000Z';
  const apply = (actor: MockAccount | null, operation: MockOperation) => {
    state = applyOperation(state, actor, operation, {
      now: () => now,
      id: () => `generated-${++sequence}`,
    });
  };
  const publicService = (id: string) =>
    getPublicProviders(state).find((service) => service.id === id);
  const ownerService = (id: string) =>
    getMyServices(state, owner.id).find((service) => service.id === id);

  beforeEach(() => {
    state = initialMockState();
    owner = state.accounts.find((account) => account.id === 'demo-listings')!;
    admin = state.accounts.find((account) => account.id === 'demo-admin')!;
    sequence = 0;
  });

  it('keeps pending, rejected and unpublished records out of public discovery', () => {
    expect(publicService('owned-pending')).toBeUndefined();
    expect(publicService('owned-rejected')).toBeUndefined();
    expect(publicService('owned-unpublished')).toBeUndefined();
    expect(ownerService('owned-pending')?.status).toBe('pending');
    expect(ownerService('owned-rejected')?.status).toBe('rejected');
    expect(getMyServices(state, 'demo-empty')).toEqual([]);
    expect(
      getPublicProviders(state).every(
        (service) => service.status === 'approved',
      ),
    ).toBe(true);
  });

  it('publishes an approved create request once and synchronizes the owner view', () => {
    apply(admin, { type: 'approve', requestId: 'request-pending' });
    expect(publicService('owned-pending')?.serviceTitle).toBe(
      'خدمة تجريبية قيد المراجعة',
    );
    expect(ownerService('owned-pending')?.status).toBe('approved');
    expect(
      state.requests.find((request) => request.id === 'request-pending')
        ?.reviewedAt,
    ).toBe(now);
    const reviewed = state;
    expect(() =>
      apply(admin, { type: 'approve', requestId: 'request-pending' }),
    ).toThrow();
    expect(state).toBe(reviewed);
    expect(
      state.services.filter((service) => service.id === 'owned-pending'),
    ).toHaveLength(1);
  });

  it('rejects a create request with a required reason without publishing it', () => {
    expect(() =>
      apply(admin, {
        type: 'reject',
        requestId: 'request-pending',
        reason: '   ',
      }),
    ).toThrow();
    expect(
      state.requests.find((request) => request.id === 'request-pending')
        ?.status,
    ).toBe('pending');
    apply(admin, {
      type: 'reject',
      requestId: 'request-pending',
      reason: '  وضح العنوان  ',
    });
    expect(ownerService('owned-pending')).toMatchObject({
      status: 'rejected',
      rejectionReason: 'وضح العنوان',
    });
    expect(publicService('owned-pending')).toBeUndefined();
  });

  it('preserves published data while edits are pending, then applies approved fields', () => {
    const before = publicService('owned-changes')!;
    const proposed = state.requests.find(
      (request) => request.id === 'request-changes',
    )!.proposedData;
    expect(before.phone).not.toBe(proposed.phone);
    expect(ownerService('owned-changes')?.pendingChanges).toEqual(proposed);
    apply(admin, { type: 'approve', requestId: 'request-changes' });
    expect(publicService('owned-changes')).toMatchObject({
      ...before,
      phone: proposed.phone,
      address: proposed.address,
    });
    expect(ownerService('owned-changes')?.pendingChanges).toBeUndefined();
    expect(
      state.services.filter((service) => service.id === 'owned-changes'),
    ).toHaveLength(1);
  });

  it('rejects an edit without changing or removing the published listing', () => {
    const before = publicService('owned-changes');
    apply(admin, {
      type: 'reject',
      requestId: 'request-changes',
      reason: 'راجع رقم التواصل',
    });
    expect(publicService('owned-changes')).toEqual(before);
    expect(ownerService('owned-changes')).toMatchObject({
      status: 'approved',
      editRejectionReason: 'راجع رقم التواصل',
    });
    expect(ownerService('owned-changes')?.pendingChanges).toBeUndefined();
  });

  it('resubmits a rejected create request as pending without duplicating owner cards', () => {
    const rejected = ownerService('owned-rejected')!;
    apply(owner, {
      type: 'submit',
      providerId: rejected.id,
      values: { ...rejected, address: 'عنوان واضح جديد' },
    });
    expect(ownerService(rejected.id)).toMatchObject({
      status: 'pending',
      address: 'عنوان واضح جديد',
    });
    expect(ownerService(rejected.id)?.rejectionReason).toBeUndefined();
    expect(
      getMyServices(state, owner.id).filter(
        (service) => service.id === rejected.id,
      ),
    ).toHaveLength(1);
    expect(publicService(rejected.id)).toBeUndefined();
  });

  it('requires explicit replacement of pending edits and preserves approved data', () => {
    const before = publicService('owned-changes')!;
    const values = { ...before, serviceTitle: 'تخصص مقترح آخر' };
    expect(() =>
      apply(owner, { type: 'submit', providerId: before.id, values }),
    ).toThrow();
    apply(owner, {
      type: 'submit',
      providerId: before.id,
      values,
      replacePending: true,
    });
    expect(publicService(before.id)).toEqual(before);
    expect(ownerService(before.id)?.pendingChanges?.serviceTitle).toBe(
      values.serviceTitle,
    );
    expect(
      state.requests.filter(
        (request) =>
          request.providerId === before.id && request.status === 'pending',
      ),
    ).toHaveLength(1);
  });

  it('unpublishes a service immediately without implicitly closing reports', () => {
    apply(admin, { type: 'unpublish', providerId: 'owned-approved' });
    expect(publicService('owned-approved')).toBeUndefined();
    expect(ownerService('owned-approved')?.publicationStatus).toBe(
      'unpublished',
    );
    expect(
      state.reports.find((report) => report.id === 'report-open')?.status,
    ).toBe('open');
    expect(() =>
      apply(admin, { type: 'unpublish', providerId: 'owned-approved' }),
    ).toThrow();
  });

  it('closes reports independently, including reports for missing services', () => {
    const before = state.services;
    for (const reportId of [
      'report-open',
      'report-missing',
      'report-unpublished',
    ])
      apply(admin, { type: 'closeReport', reportId });
    expect(
      state.reports.every(
        (report) => report.status === 'closed' && report.closedAt === now,
      ),
    ).toBe(true);
    expect(state.services).toBe(before);
    expect(() =>
      apply(admin, { type: 'closeReport', reportId: 'report-open' }),
    ).toThrow();
  });

  it('blocks guest, forged-admin and provider moderation, plus edits to another owner', () => {
    const operation = {
      type: 'approve',
      requestId: 'request-pending',
    } as const;
    expect(() => apply(null, operation)).toThrow();
    expect(() => apply(owner, operation)).toThrow();
    expect(() => apply({ ...owner, role: 'admin' }, operation)).toThrow();
    const stranger = state.accounts.find(
      (account) => account.id === 'demo-empty',
    )!;
    expect(() =>
      apply(stranger, {
        type: 'submit',
        providerId: 'owned-approved',
        values: publicService('owned-approved')!,
      }),
    ).toThrow();
  });

  it('does not mutate input state and rejects invalid, unchanged or unavailable submissions', () => {
    const before = JSON.stringify(state);
    const values = publicService('owned-approved')!;
    expect(() =>
      apply(owner, { type: 'submit', providerId: values.id, values }),
    ).toThrow();
    expect(() =>
      apply(owner, { type: 'submit', values: { ...values, phone: '123' } }),
    ).toThrow();
    expect(() =>
      apply(owner, {
        type: 'submit',
        providerId: 'owned-unpublished',
        values: { ...values, serviceTitle: 'جديد' },
      }),
    ).toThrow();
    expect(() =>
      apply(admin, { type: 'approve', requestId: 'missing' }),
    ).toThrow();
    expect(JSON.stringify(state)).toBe(before);
  });

  it('compares editable fields only and treats absent optional WhatsApp as empty', () => {
    const values = publicService('owned-approved')!;
    expect(
      changedFields(
        { ...values, whatsapp: undefined },
        { ...values, whatsapp: '' },
      ),
    ).toEqual([]);
    expect(
      changedFields(values, {
        ...values,
        phone: '01100000001',
        address: 'عنوان مختلف',
      }),
    ).toEqual(['phone', 'address']);
  });

  it('normalizes a new local submission and keeps it private until admin approval', () => {
    const actor = state.accounts.find(
      (account) => account.id === 'demo-empty',
    )!;
    const values = {
      ...publicService('owned-approved')!,
      name: '  اسم تجريبي  ',
      phone: '+٢٠ ١٠ ١٢٣٤ ٥٦٧٨',
      whatsapp: '0020 (11) 1234-5678',
    };
    apply(actor, { type: 'submit', values });
    const mine = getMyServices(state, actor.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      name: 'اسم تجريبي',
      phone: '01012345678',
      whatsapp: '01112345678',
      status: 'pending',
    });
    expect(publicService(mine[0].id)).toBeUndefined();
    const pending = state.requests.find(
      (request) => request.providerId === mine[0].id,
    )!;
    apply(admin, { type: 'approve', requestId: pending.id });
    expect(publicService(mine[0].id)?.phone).toBe('01012345678');
  });

  it('updates only the signed-in account name and preserves listing display names', () => {
    const services = state.services;
    apply(owner, { type: 'updateAccount', name: '  اسم حساب جديد  ' });
    expect(
      state.accounts.find((account) => account.id === owner.id)?.name,
    ).toBe('اسم حساب جديد');
    expect(
      state.accounts.find((account) => account.id === admin.id)?.name,
    ).toBe(admin.name);
    expect(state.services).toBe(services);
    expect(() => apply(owner, { type: 'updateAccount', name: ' ' })).toThrow();
  });

  it('refuses approving updates whose published service is missing or unpublished', () => {
    const request = state.requests.find(
      (item) => item.id === 'request-changes',
    )!;
    const original = state;
    state = {
      ...state,
      services: state.services.filter(
        (service) => service.id !== request.providerId,
      ),
    };
    expect(() =>
      apply(admin, { type: 'approve', requestId: request.id }),
    ).toThrow();
    state = original;
    apply(admin, { type: 'unpublish', providerId: request.providerId });
    expect(() =>
      apply(admin, { type: 'approve', requestId: request.id }),
    ).toThrow();
    expect(state.requests.find((item) => item.id === request.id)?.status).toBe(
      'pending',
    );
  });
});

describe('submission isolation', () => {
  it('blocks identical repeated new submissions and admin submission', () => {
    let state = initialMockState();
    const owner = state.accounts.find(
      (account) => account.id === 'demo-empty',
    )!;
    const admin = state.accounts.find((account) => account.role === 'admin')!;
    const values = state.services[0];
    let seq = 0;
    const env = { now: () => '2026-11-03', id: () => `repeat-${++seq}` };
    state = applyOperation(state, owner, { type: 'submit', values }, env);
    expect(() =>
      applyOperation(state, owner, { type: 'submit', values }, env),
    ).toThrow();
    expect(() =>
      applyOperation(state, admin, { type: 'submit', values }, env),
    ).toThrow();
  });
});
