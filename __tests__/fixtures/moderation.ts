import { providers } from './providers';
import { categories } from '../../src/features/discovery/data/categories';
import {
  normalizeMobile,
  validateService,
} from '../../src/features/provider/validation';
import type {
  MockAccount,
  MockOperation,
  MockState,
  ProviderListing,
  ServiceValues,
} from '../../src/features/provider/types';

import { changedFields } from '../../src/features/provider/changedFields';
export { changedFields } from '../../src/features/provider/changedFields';
function cleanValues(values: ServiceValues): ServiceValues {
  const result: ServiceValues = {
    ...values,
    serviceMode: values.serviceMode || 'fixed',
  };
  for (const key of [
    'name',
    'categoryId',
    'serviceTitle',
    'description',
    'phone',

    'address',
  ] as const)
    result[key] = String(values[key] ?? '').trim();
  result.phone = normalizeMobile(result.phone);
  result.whatsapp = result.whatsapp
    ? normalizeMobile(result.whatsapp)
    : undefined;
  if (
    Object.keys({
      ...validateService(result, 1, true),
      ...validateService(result, 2, true),
    }).length ||
    !categories.some((category) => category.id === result.categoryId)
  )
    throw new Error('راجع بيانات الخدمة ورقم الموبايل والمنطقة قبل الإرسال.');
  return result;
}
export function initialMockState(): MockState {
  const accounts: MockAccount[] = [
    {
      id: 'demo-empty',
      name: 'حساب تجريبي جديد',
      email: 'empty@example.test',
      role: 'provider',
    },
    {
      id: 'demo-listings',
      name: 'أحمد محمود',
      email: 'provider@example.test',
      role: 'provider',
    },
    {
      id: 'demo-admin',
      name: 'عمر حسن',
      email: 'admin@example.test',
      role: 'admin',
    },
    {
      id: 'fixture-owner',
      name: 'مزود تجريبي',
      email: 'fixture@example.test',
      role: 'provider',
    },
  ];
  const sample = cleanValues(providers[0]);
  const services: MockState['services'] = [
    ...providers
      .filter((provider) => provider.status === 'approved')
      .map((provider) => ({
        ...cleanValues(provider),
        id: provider.id,
        ownerId: 'fixture-owner',
        publicationStatus: 'published' as const,
      })),
    ...[
      'owned-approved',
      'owned-changes',
      'owned-rejected-edit',
      'owned-unpublished',
    ].map((id) => ({
      ...sample,
      id,
      ownerId: 'demo-listings',
      publicationStatus:
        id === 'owned-unpublished'
          ? ('unpublished' as const)
          : ('published' as const),
    })),
  ];
  const createdAt = '2026-11-03T10:00:00.000Z';
  return {
    accounts,
    services,
    requests: [
      {
        id: 'request-pending',
        providerId: 'owned-pending',
        ownerId: 'demo-listings',
        type: 'create',
        status: 'pending',
        proposedData: { ...sample, serviceTitle: 'خدمة تجريبية قيد المراجعة' },
        createdAt,
      },
      {
        id: 'request-rejected',
        providerId: 'owned-rejected',
        ownerId: 'demo-listings',
        type: 'create',
        status: 'rejected',
        proposedData: { ...sample, serviceTitle: 'خدمة تجريبية تحتاج تعديل' },
        rejectionReason: 'يرجى توضيح العنوان.',
        createdAt,
        reviewedAt: createdAt,
      },
      {
        id: 'request-changes',
        providerId: 'owned-changes',
        ownerId: 'demo-listings',
        type: 'update',
        status: 'pending',
        proposedData: {
          ...sample,
          phone: '01100000001',
          address: 'شارع المدارس، بجوار المسجد الكبير',
        },
        createdAt,
      },
      {
        id: 'request-rejected-edit',
        providerId: 'owned-rejected-edit',
        ownerId: 'demo-listings',
        type: 'update',
        status: 'rejected',
        proposedData: { ...sample, serviceTitle: 'تخصص مقترح' },
        rejectionReason: 'يرجى توضيح التخصص.',
        createdAt,
        reviewedAt: createdAt,
      },
    ],
    reports: [
      {
        id: 'report-open',
        providerId: 'owned-approved',
        reason: 'رقم الموبايل غير متاح — بلاغ تجريبي.',
        status: 'open',
        createdAt,
      },
      {
        id: 'report-unpublished',
        providerId: 'owned-unpublished',
        reason: 'بيانات عنوان غير واضحة — بلاغ تجريبي.',
        status: 'open',
        createdAt,
      },
      {
        id: 'report-missing',
        providerId: 'missing-service',
        reason: 'بلاغ تجريبي عن خدمة غير متاحة.',
        status: 'open',
        createdAt,
      },
    ],
  };
}

export function getPublicProviders(state: MockState) {
  return state.services
    .filter((service) => service.publicationStatus === 'published')
    .map((service) => ({ ...service, status: 'approved' as const }));
}
export function getMyServices(
  state: MockState,
  userId: string,
): ProviderListing[] {
  const ids = new Set([
    ...state.services
      .filter((service) => service.ownerId === userId)
      .map((service) => service.id),
    ...state.requests
      .filter((request) => request.ownerId === userId)
      .map((request) => request.providerId),
  ]);
  return [...ids].flatMap<ProviderListing>((id) => {
    const service = state.services.find(
      (item) => item.id === id && item.ownerId === userId,
    );
    const history = state.requests.filter(
      (request) => request.providerId === id && request.ownerId === userId,
    );
    const pending = history.find((request) => request.status === 'pending');
    const latest = history.at(-1);
    if (service)
      return [
        {
          ...service,
          status: 'approved' as const,
          pendingChanges: pending?.proposedData,
          editRejectionReason:
            !pending &&
            latest?.type === 'update' &&
            latest.status === 'rejected'
              ? latest.rejectionReason
              : undefined,
        },
      ];
    if (!latest) return [];
    return [
      {
        ...latest.proposedData,
        id,
        ownerId: userId,
        status:
          latest.status === 'rejected'
            ? ('rejected' as const)
            : ('pending' as const),
        rejectionReason: latest.rejectionReason,
      },
    ];
  });
}

export function applyOperation(
  state: MockState,
  actor: MockAccount | null,
  operation: MockOperation,
  env: { now: () => string; id: () => string },
): MockState {
  if (
    !actor ||
    !state.accounts.some(
      (account) => account.id === actor.id && account.role === actor.role,
    )
  )
    throw new Error('سجّل الدخول بالحساب المناسب أولًا.');
  const now = env.now();
  if (operation.type === 'updateAccount') {
    const name = operation.name.trim();
    if (!name) throw new Error('الاسم مطلوب.');
    return {
      ...state,
      accounts: state.accounts.map((account) =>
        account.id === actor.id ? { ...account, name } : account,
      ),
    };
  }
  if (operation.type === 'submit') {
    if (actor.role !== 'provider')
      throw new Error('إضافة الخدمات متاحة لحساب مقدم الخدمة فقط.');
    const values = cleanValues(operation.values);
    if (
      !operation.providerId &&
      state.requests.some(
        (request) =>
          request.ownerId === actor.id &&
          request.type === 'create' &&
          request.status === 'pending' &&
          !changedFields(request.proposedData, values).length,
      )
    )
      throw new Error('تم إرسال نفس الطلب بالفعل وهو قيد المراجعة.');
    const providerId = operation.providerId ?? env.id();
    const service = state.services.find((item) => item.id === providerId);
    const history = state.requests.filter(
      (request) => request.providerId === providerId,
    );
    if (operation.providerId && !service && !history.length)
      throw new Error('الخدمة غير موجودة.');
    if (
      (service && service.ownerId !== actor.id) ||
      history.some((request) => request.ownerId !== actor.id)
    )
      throw new Error('الخدمة دي مش متاحة لحسابك.');
    if (service?.publicationStatus === 'unpublished')
      throw new Error('لا يمكن تعديل خدمة غير منشورة في النسخة الحالية.');
    if (service && !changedFields(service, values).length)
      throw new Error('مفيش تغييرات جديدة لإرسالها.');
    const pending = history.find((request) => request.status === 'pending');
    if (pending) {
      if (service && !operation.replacePending)
        throw new Error(
          'يوجد طلب تعديل قيد المراجعة. افتح التعديلات المرسلة لتحديثها.',
        );
      return {
        ...state,
        requests: state.requests.map((request) =>
          request.id === pending.id
            ? { ...request, proposedData: values, createdAt: now }
            : request,
        ),
      };
    }
    return {
      ...state,
      requests: [
        ...state.requests,
        {
          id: env.id(),
          providerId,
          ownerId: actor.id,
          type: service ? 'update' : 'create',
          status: 'pending',
          proposedData: values,
          createdAt: now,
        },
      ],
    };
  }
  if (actor.role !== 'admin')
    throw new Error('العملية متاحة للمشرف التجريبي فقط.');
  if (operation.type === 'unpublish') {
    const service = state.services.find(
      (item) => item.id === operation.providerId,
    );
    if (!service || service.publicationStatus !== 'published')
      throw new Error('الخدمة غير موجودة أو غير منشورة بالفعل.');
    return {
      ...state,
      services: state.services.map((item) =>
        item.id === service.id
          ? { ...item, publicationStatus: 'unpublished' }
          : item,
      ),
    };
  }
  if (operation.type === 'closeReport') {
    const report = state.reports.find((item) => item.id === operation.reportId);
    if (!report || report.status !== 'open')
      throw new Error('البلاغ غير موجود أو تم إغلاقه بالفعل.');
    return {
      ...state,
      reports: state.reports.map((item) =>
        item.id === report.id
          ? { ...item, status: 'closed', closedAt: now }
          : item,
      ),
    };
  }
  const request = state.requests.find(
    (item) => item.id === operation.requestId,
  );
  if (!request || request.status !== 'pending')
    throw new Error('الطلب غير موجود أو تمت مراجعته بالفعل.');
  if (!state.accounts.some((account) => account.id === request.ownerId))
    throw new Error('حساب صاحب الطلب غير موجود.');
  if (operation.type === 'reject') {
    const reason = operation.reason.trim();
    if (!reason) throw new Error('سبب الرفض مطلوب.');
    return {
      ...state,
      requests: state.requests.map((item) =>
        item.id === request.id
          ? {
              ...item,
              status: 'rejected',
              rejectionReason: reason,
              reviewedAt: now,
            }
          : item,
      ),
    };
  }
  const values = cleanValues(request.proposedData);
  const target = state.services.find(
    (service) => service.id === request.providerId,
  );
  if (request.type === 'create' && target)
    throw new Error('الخدمة موجودة بالفعل؛ لا يمكن نشر نسخة مكررة.');
  if (
    request.type === 'update' &&
    (!target || target.publicationStatus !== 'published')
  )
    throw new Error('الخدمة غير منشورة؛ لا يمكن اعتماد التعديلات.');
  if (target && target.ownerId !== request.ownerId)
    throw new Error('بيانات صاحب الطلب غير متطابقة.');
  const services =
    request.type === 'create'
      ? [
          ...state.services,
          {
            ...values,
            id: request.providerId,
            ownerId: request.ownerId,
            publicationStatus: 'published' as const,
          },
        ]
      : state.services.map((service) =>
          service.id === request.providerId
            ? {
                ...service,
                ...Object.fromEntries(
                  changedFields(service, values).map((key) => [
                    key,
                    values[key],
                  ]),
                ),
              }
            : service,
        );
  return {
    ...state,
    services,
    requests: state.requests.map((item) =>
      item.id === request.id
        ? { ...item, status: 'approved', reviewedAt: now }
        : item,
    ),
  };
}
