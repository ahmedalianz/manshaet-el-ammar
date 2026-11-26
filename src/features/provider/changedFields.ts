import type { ServiceValues } from './types';
export const editableFields: (keyof ServiceValues)[] = [
  'name',
  'categoryId',
  'serviceTitle',
  'description',
  'phone',
  'whatsapp',

  'address',
  'serviceMode',
  'weeklyHours',
  'photoChange',
];
export function changedFields(
  current: ServiceValues,
  proposed: ServiceValues,
): (keyof ServiceValues)[] {
  return editableFields.filter(
    (key) =>
      canonicalJSON(current[key] ?? '') !== canonicalJSON(proposed[key] ?? ''),
  );
}

export function canonicalJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJSON(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
