import type { PhotoDraft } from './api';
export function validPhotoDraft(value: unknown): value is PhotoDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const draft = value as Record<string, unknown>;
  if (!['keep', 'replace', 'remove'].includes(String(draft.action)))
    return false;
  for (const key of ['candidateId', 'submissionId'])
    if (
      draft[key] !== undefined &&
      (typeof draft[key] !== 'string' ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(draft[key] as string))
    )
      return false;
  if (
    draft.needsCleanup !== undefined &&
    typeof draft.needsCleanup !== 'boolean'
  )
    return false;
  if (draft.uploaded !== undefined && typeof draft.uploaded !== 'boolean')
    return false;
  if (
    draft.localUri !== undefined &&
    (typeof draft.localUri !== 'string' ||
      !draft.localUri.startsWith('file://') ||
      !draft.localUri.includes('/service-photo-drafts/') ||
      /\.\.|%2e/i.test(draft.localUri))
  )
    return false;
  return draft.action !== 'replace' || typeof draft.localUri === 'string';
}
