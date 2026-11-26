import { deleteDraftPhoto } from '../photos/draftFiles';
import { validPhotoDraft } from '../photos/draftValidation';
import type { PhotoDraft } from '../photos/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ServiceValues } from '../provider/types';
export type ServiceDraft = {
  photoDraft?: PhotoDraft;
  values: ServiceValues;
  step: 1 | 2;
  sameNumber: boolean;
  baseRevision?: string;
  savedAt: string;
};
const PREFIX = 'directory.draft.v1.';
const epochs = new Map<string, number>();
let queue = Promise.resolve();
export const draftEpoch = (uid: string) => epochs.get(uid) ?? 0;
const storageKey = (uid: string, key: string) =>
  `${PREFIX}${encodeURIComponent(uid)}.${encodeURIComponent(key)}`;
export async function readDraft(
  uid: string,
  key: string,
): Promise<ServiceDraft | null> {
  const epoch = draftEpoch(uid);
  await queue.catch(() => {});
  const raw = await AsyncStorage.getItem(storageKey(uid, key));
  if (!raw || epoch !== draftEpoch(uid)) return null;
  try {
    const draft = JSON.parse(raw);
    if (
      !draft ||
      ![1, 2].includes(draft.step) ||
      typeof draft.sameNumber !== 'boolean' ||
      !Number.isFinite(Date.parse(draft.savedAt)) ||
      !draft.values
    )
      return null;
    const value = draft.values;
    delete value.area;
    delete value.areaId;
    delete value.areadId;
    delete value.coverageAreas;
    if (
      ![
        'name',
        'categoryId',
        'serviceTitle',
        'description',
        'phone',

        'address',
      ].every(
        (key) => typeof value[key] === 'string' && value[key].length <= 2000,
      )
    )
      return null;
    if (value.whatsapp !== undefined && typeof value.whatsapp !== 'string')
      return null;
    if (
      value.serviceMode !== undefined &&
      !['fixed', 'mobile', 'both'].includes(value.serviceMode)
    )
      return null;
    if (value.weeklyHours !== undefined) {
      if (
        !value.weeklyHours ||
        typeof value.weeklyHours !== 'object' ||
        Array.isArray(value.weeklyHours)
      )
        return null;
      for (const [key, day] of Object.entries(value.weeklyHours) as [
        string,
        { status?: unknown; periods?: unknown },
      ][]) {
        if (
          !['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'].includes(key) ||
          !day ||
          !['unspecified', 'closed', 'appointment', 'allDay', 'open'].includes(
            String(day.status),
          )
        )
          return null;
        if (
          day.periods !== undefined &&
          (!Array.isArray(day.periods) ||
            day.periods.length > 2 ||
            day.periods.some(
              (period) =>
                !period ||
                typeof period.start !== 'string' ||
                typeof period.end !== 'string' ||
                typeof period.overnight !== 'boolean',
            ))
        )
          return null;
      }
    }
    const clean: ServiceDraft = {
      values: value,
      ...(validPhotoDraft(draft.photoDraft)
        ? { photoDraft: draft.photoDraft }
        : {}),
      step: draft.step,
      sameNumber: draft.sameNumber,
      savedAt: draft.savedAt,
      ...(typeof draft.baseRevision === 'string'
        ? { baseRevision: draft.baseRevision }
        : {}),
    };
    return epoch === draftEpoch(uid) ? clean : null;
  } catch {
    return null;
  }
}
export function saveDraft(
  uid: string,
  key: string,
  draft: ServiceDraft,
  expectedEpoch = draftEpoch(uid),
) {
  const {
    name,
    categoryId,
    serviceTitle,
    description,
    phone,
    whatsapp,
    address,
    serviceMode,
    weeklyHours,
  } = draft.values;
  const clean: ServiceDraft = {
    ...(draft.photoDraft ? { photoDraft: draft.photoDraft } : {}),
    values: {
      name,
      categoryId,
      serviceTitle,
      description,
      phone,
      whatsapp,
      address,
      serviceMode,
      weeklyHours,
    },
    step: draft.step,
    sameNumber: draft.sameNumber,
    savedAt: draft.savedAt,
    ...(draft.baseRevision ? { baseRevision: draft.baseRevision } : {}),
  };
  queue = queue
    .catch(() => {})
    .then(async () => {
      if (expectedEpoch === draftEpoch(uid)) {
        const targetKey = storageKey(uid, key);
        const prefix = `${PREFIX}${encodeURIComponent(uid)}.`;
        const previous = await AsyncStorage.getItem(targetKey);
        await AsyncStorage.setItem(targetKey, JSON.stringify(clean));
        removePhotoFile(previous, clean.photoDraft?.localUri);
        const otherKeys = (await AsyncStorage.getAllKeys()).filter(
          (candidate) =>
            candidate.startsWith(prefix) && candidate !== targetKey,
        );
        if (otherKeys.length) {
          for (const otherKey of otherKeys) {
            removePhotoFile(
              await AsyncStorage.getItem(otherKey),
              clean.photoDraft?.localUri,
            );
          }
          await AsyncStorage.multiRemove(otherKeys);
        }
      }
    });
  return queue;
}
function removePhotoFile(raw: string | null, keepUri?: string) {
  if (!raw) return;
  try {
    const uri = JSON.parse(raw)?.photoDraft?.localUri;
    if (typeof uri === 'string' && uri !== keepUri) deleteDraftPhoto(uri);
  } catch {}
}
export function discardDraft(uid: string, key: string) {
  queue = queue
    .catch(() => {})
    .then(async () => {
      const raw = await AsyncStorage.getItem(storageKey(uid, key));
      removePhotoFile(raw);
      await AsyncStorage.removeItem(storageKey(uid, key));
    });
  return queue;
}
export function clearUserDrafts(uid: string) {
  epochs.set(uid, draftEpoch(uid) + 1);
  queue = queue
    .catch(() => {})
    .then(async () => {
      const keys = (await AsyncStorage.getAllKeys()).filter((key) =>
        key.startsWith(`${PREFIX}${encodeURIComponent(uid)}.`),
      );
      if (keys.length) {
        for (const key of keys)
          removePhotoFile(await AsyncStorage.getItem(key));
        await AsyncStorage.multiRemove(keys);
      }
    });
  return queue;
}

export async function listDrafts(uid: string) {
  await queue.catch(() => {});
  const prefix = `${PREFIX}${encodeURIComponent(uid)}.`;
  const keys = (await AsyncStorage.getAllKeys()).filter((key) =>
    key.startsWith(prefix),
  );
  const drafts = await Promise.all(
    keys.map(async (key) => {
      const id = decodeURIComponent(key.slice(prefix.length));
      const draft = await readDraft(uid, id);
      return draft ? { id, ...draft } : null;
    }),
  );
  return drafts
    .filter((draft): draft is ServiceDraft & { id: string } => Boolean(draft))
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
