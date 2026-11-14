import { createHash } from 'node:crypto';
const obsolete = new Set(['areaId', 'areadId', 'area']);
const quote = (key) =>
  `\`${key.replaceAll('\\', '\\\\').replaceAll('`', '\\`')}\``;
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, item]) => [key, canonical(item)]),
        )
      : value;
export const fingerprint = (fields) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(fields)))
    .digest('hex');
export function legacyAreaRemovalPlan(original) {
  const cleaned = structuredClone(original ?? {}),
    removed = [];
  function walk(fields, prefix = []) {
    for (const [key, value] of Object.entries(fields ?? {})) {
      const path = [...prefix, quote(key)];
      if (obsolete.has(key)) {
        removed.push({ path: path.join('.'), value: structuredClone(value) });
        delete fields[key];
      } else if (value.mapValue) walk(value.mapValue.fields, path);
      else if (value.arrayValue)
        for (const item of value.arrayValue.values ?? []) {
          const count = removed.length;
          if (item.mapValue) walk(item.mapValue.fields, path);
          if (removed.length !== count)
            throw new Error(
              'Legacy fields inside an array require a dedicated migration.',
            );
        }
    }
  }
  walk(cleaned);
  return { removed, fingerprint: fingerprint(cleaned) };
}
export function deletionMask(fields, updateTime) {
  const params = new URLSearchParams({
    'currentDocument.updateTime': updateTime,
  });
  for (const field of fields)
    params.append('updateMask.fieldPaths', field.path);
  return params;
}
