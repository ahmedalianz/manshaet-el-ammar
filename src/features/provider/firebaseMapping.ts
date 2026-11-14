import type { Availability, WeeklyHours } from '../availability/types';
import { validateAvailability } from '../availability/validation';
import { canonicalJSON } from './changedFields';
import { categories } from '../discovery/data/categories';
import type { ServiceCategory, ServiceProvider } from '../discovery/types';
import type { ProviderListing, ServiceRequest, ServiceValues } from './types';
import { normalizeMobile, validateService } from './validation';

// Compact day tuples keep full-week validation within Firestore's expression limit.
// [status,startMinute,endMinute,secondStart,secondEnd]; unused periods use zeroes.
type StoredWeek = Partial<Record<keyof WeeklyHours, string>>;
export type StoredServiceValues = Omit<Availability, 'weeklyHours'> & {
  weeklyHours?: StoredWeek;
  displayName: string;
  categoryId: string;
  serviceTitle: string;
  description: string;
  phone: string;
  whatsapp?: string;

  address: string;
  location?: { latitude: number; longitude: number };
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('في بيانات مش صحيحة في الخدمة. راجعها وجرّب تاني.');
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, optional = false): string {
  if (optional && value === undefined) return '';
  if (
    typeof value !== 'string' ||
    value.length > max ||
    (!optional && !value.trim())
  )
    throw new Error('في بيانات مش صحيحة في الخدمة. راجعها وجرّب تاني.');
  return value.trim();
}
export function timestampISO(value: unknown): string {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    const date: unknown = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime()))
      return date.toISOString();
  }
  throw new Error('في مشكلة في تاريخ البيانات. جرّب تحدّث الصفحة.');
}
export function toStoredValues(values: ServiceValues): StoredServiceValues {
  const normalized: ServiceValues = {
    name: text(values.name, 100),
    categoryId: text(values.categoryId, 100),
    serviceTitle: text(values.serviceTitle, 160),
    description: text(values.description, 2000, true),
    phone: normalizeMobile(values.phone),
    whatsapp: values.whatsapp?.trim()
      ? normalizeMobile(values.whatsapp)
      : undefined,

    address: text(values.address, 500, values.serviceMode === 'mobile'),
    ...availabilityValues(values),
  };
  if (
    Object.keys({
      ...validateService(normalized, 1, true),
      ...Object.fromEntries(
        Object.entries(validateService(normalized, 2, true)).filter(
          ([key]) =>
            key !== 'serviceMode' || normalized.serviceMode !== undefined,
        ),
      ),
    }).length
  )
    throw new Error('راجع بيانات الخدمة ورقم الموبايل.');
  return {
    displayName: normalized.name,
    categoryId: normalized.categoryId,
    serviceTitle: normalized.serviceTitle,
    description: normalized.description,
    phone: normalized.phone,
    ...(normalized.whatsapp ? { whatsapp: normalized.whatsapp } : {}),

    address: normalized.address,
    ...storedAvailability(normalized),
  };
}
export function fromStoredValues(value: unknown): ServiceValues {
  const data = record(value);
  const result: ServiceValues = {
    name: text(data.displayName, 100),
    categoryId: text(data.categoryId, 100),
    serviceTitle: text(data.serviceTitle, 160),
    description: text(data.description, 2000, true),
    phone: text(data.phone, 30),
    ...(data.whatsapp ? { whatsapp: text(data.whatsapp, 30) } : {}),

    address: text(data.address, 500, data.serviceMode === 'mobile'),
    ...readAvailability(data),
  };
  toStoredValues(result);
  return result;
}
export function mapCategory(id: string, value: unknown): ServiceCategory {
  const data = record(value);
  if (data.active !== true) throw new Error('القسم غير متاح.');
  const metadata = categories.find((category) => category.id === id);
  const icon =
    categories.find((category) => category.icon === data.icon)?.icon ??
    'briefcase-outline';
  return {
    id,
    name: text(data.name, 100),
    description: text(data.description, 500, true),
    icon,
    group: metadata?.group ?? 'community',
    keywords: metadata?.keywords ?? [],
  };
}
export function mapProvider(id: string, value: unknown): ServiceProvider {
  const data = record(value);
  const fields = fromStoredValues(data);
  return {
    ...fields,
    id,
    status: 'approved',
    dataSource: 'firestore',
    publicationStatus: 'published',
    ...(data.location ? mapLocation(data.location) : {}),
    ...((data.updatedAt ?? data.publishedAt)
      ? { updatedAt: timestampISO(data.updatedAt ?? data.publishedAt) }
      : {}),
    ...(data.lastConfirmedAt
      ? { lastConfirmedAt: timestampISO(data.lastConfirmedAt) }
      : {}),
  };
}
function mapLocation(value: unknown) {
  const location = record(value);
  const latitude = location.latitude,
    longitude = location.longitude;
  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  )
    throw new Error('الموقع ده مش صحيح. راجعه وجرّب تاني.');
  return { latitude, longitude };
}
export function mapOwnedProvider(
  id: string,
  value: unknown,
  uid: string,
): ProviderListing {
  const data = record(value);
  if (data.ownerId !== uid) throw new Error('الخدمة دي مش متاحة لحسابك.');
  return { ...mapProvider(id, data), ownerId: uid };
}
export function mapRequest(
  id: string,
  value: unknown,
  uid: string,
): ServiceRequest {
  const data = record(value);
  if (
    data.ownerId !== uid ||
    !['create', 'update', 'restore'].includes(String(data.type)) ||
    !['pending', 'approved', 'rejected'].includes(String(data.status))
  )
    throw new Error('في بيانات مش صحيحة في الطلب. راجعها وجرّب تاني.');
  return {
    id,
    ownerId: uid,
    providerId: text(data.providerId, 200),
    type: data.type as ServiceRequest['type'],
    status: data.status as ServiceRequest['status'],
    proposedData: fromStoredValues(data.proposedData),
    createdAt: timestampISO(data.createdAt),
    ...(data.reviewedAt ? { reviewedAt: timestampISO(data.reviewedAt) } : {}),
    ...(data.rejectionReason
      ? { rejectionReason: text(data.rejectionReason, 1000) }
      : {}),
  };
}
export function storedValuesMatch(
  left: unknown,
  right: StoredServiceValues,
): boolean {
  try {
    const leftRecord = record(left);
    const normalized = toStoredValues(fromStoredValues(left));
    return (
      !leftRecord.location && canonicalJSON(normalized) === canonicalJSON(right)
    );
  } catch {
    return false;
  }
}

export function mapArchivedProvider(
  id: string,
  value: unknown,
  uid: string,
): ProviderListing {
  const data = record(value);
  if (data.ownerId !== uid || data.archiveStatus !== 'unpublished')
    throw new Error('الخدمة دي مش موجودة في الأرشيف.');
  return {
    ...mapOwnedProvider(id, data, uid),
    publicationStatus: 'unpublished',
    unpublishReason: text(data.unpublishReason, 1000),
    unpublishedAt: timestampISO(data.unpublishedAt),
    updatedAt: timestampISO(data.unpublishedAt),
  };
}

function availabilityValues(
  data: Availability | Record<string, unknown>,
): Availability {
  const result = {
    ...(data.serviceMode !== undefined
      ? { serviceMode: data.serviceMode }
      : {}),
    ...(data.coverageAreas !== undefined
      ? { coverageAreas: data.coverageAreas }
      : {}),
    ...(data.weeklyHours !== undefined
      ? { weeklyHours: data.weeklyHours }
      : {}),
  } as Availability;
  if (Object.keys(validateAvailability(result)).length)
    throw new Error('راجع طريقة تقديم الخدمة ومواعيد العمل.');
  return result;
}

const dayStatusCodes = {
  unspecified: 0,
  closed: 1,
  appointment: 2,
  allDay: 3,
  open: 4,
} as const;
function storedAvailability(
  value: Availability,
): Omit<Availability, 'weeklyHours'> & { weeklyHours?: StoredWeek } {
  const clean = availabilityValues(value);
  const minute = (time: string) =>
    Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const weeklyHours = clean.weeklyHours
    ? Object.fromEntries(
        (['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] as const).map(
          (key) => {
            const day = clean.weeklyHours![key] ?? {
              status: 'unspecified' as const,
            };
            const tuple: number[] =
              day!.status === 'open'
                ? [
                    4,
                    ...[...day!.periods!]
                      .sort((a, b) => minute(a.start) - minute(b.start))
                      .flatMap((period) => [
                        minute(period.start),
                        minute(period.end) + (period.overnight ? 1440 : 0),
                      ]),
                  ]
                : [dayStatusCodes[day!.status]];
            while (tuple.length < 5) tuple.push(0);
            return [key, tuple.join(',')];
          },
        ),
      )
    : undefined;
  return {
    ...(clean.serviceMode ? { serviceMode: clean.serviceMode } : {}),
    ...(clean.coverageAreas ? { coverageAreas: clean.coverageAreas } : {}),
    ...(weeklyHours ? { weeklyHours } : {}),
  };
}
function readAvailability(data: Record<string, unknown>): Availability {
  if (data.weeklyHours === undefined) return availabilityValues(data);
  const week = record(data.weeklyHours);
  const statuses = [
    'unspecified',
    'closed',
    'appointment',
    'allDay',
    'open',
  ] as const;
  const clock = (value: number) =>
    `${String(Math.floor((value % 1440) / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  const weeklyHours = Object.fromEntries(
    Object.entries(week)
      .map(([key, encoded]) => {
        if (
          typeof encoded !== 'string' ||
          !/^[0-4](,[0-9]{1,4}){4}$/.test(encoded)
        )
          throw new Error('راجع مواعيد العمل.');
        const raw = encoded.split(',').map(Number);
        if (
          !Array.isArray(raw) ||
          raw.length !== 5 ||
          !raw.every((n) => Number.isInteger(n)) ||
          raw[0] < 0 ||
          raw[0] > 4 ||
          (raw[0] !== 4 && raw.slice(1).some((n) => n !== 0))
        )
          throw new Error('راجع مواعيد العمل.');
        const periods = [];
        if (raw[0] === 4)
          for (let i = 1; i < 5; i += 2) {
            const start = raw[i],
              end = raw[i + 1];
            if (i === 3 && start === 0 && end === 0) continue;
            if (
              start < 0 ||
              start >= 1440 ||
              end <= start ||
              end > start + 1440
            )
              throw new Error('راجع مواعيد العمل.');
            periods.push({
              start: clock(start),
              end: clock(end),
              overnight: end >= 1440,
            });
          }
        return [
          key,
          { status: statuses[raw[0]], ...(raw[0] === 4 ? { periods } : {}) },
        ];
      })
      .filter(([key]) => (week[String(key)] as string).split(',')[0] !== '0'),
  );
  return availabilityValues({ ...data, weeklyHours });
}
