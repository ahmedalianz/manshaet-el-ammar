import type { User } from '@firebase/auth';
import { getPhotoApiUrl } from '../photos/api';

const MAX_PASSES = 10;

function deletionErrorCode(status: number, detail: string): string {
  if (status === 401) {
    return /Recent login required/i.test(detail)
      ? 'auth/requires-recent-login'
      : 'auth/user-token-expired';
  }
  if (status === 403) {
    return /Admin/i.test(detail)
      ? 'account/admin-cannot-delete'
      : 'permission-denied';
  }
  if (status === 404) {
    return 'account/delete-unavailable';
  }
  return 'unavailable';
}

export async function requestAccountDataDeletion(
  user: User,
  fetchImpl: typeof fetch = fetch,
): Promise<{ deletedProviderIds: string[] }> {
  const apiUrl = getPhotoApiUrl();
  if (!apiUrl) {
    throw Object.assign(new Error('Account deletion unavailable'), {
      code: 'account/delete-unavailable',
    });
  }

  const collected = new Set<string>();
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const token = await user.getIdToken(pass === 0);
    const response = await fetchImpl(`${apiUrl}/v1/account`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = (await response.json().catch(() => ({}))) as {
      deleted?: boolean;
      hasMore?: boolean;
      deletedProviderIds?: unknown;
      error?: string;
    };
    if (!response.ok) {
      const detail = typeof data.error === 'string' ? data.error : '';
      throw Object.assign(new Error(detail || 'Account deletion failed'), {
        code: deletionErrorCode(response.status, detail),
      });
    }
    if (Array.isArray(data.deletedProviderIds)) {
      for (const id of data.deletedProviderIds) {
        if (typeof id === 'string' && id) {
          collected.add(id);
        }
      }
    }
    if (data.deleted === true && !data.hasMore) {
      return { deletedProviderIds: [...collected] };
    }
  }

  throw Object.assign(new Error('Account deletion incomplete'), {
    code: 'account/delete-incomplete',
  });
}
