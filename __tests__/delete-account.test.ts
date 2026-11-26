import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { User } from '@firebase/auth';
import { requestAccountDataDeletion } from '../src/features/account/deleteAccount';

const originalPhotoApiUrl = process.env.EXPO_PUBLIC_PHOTO_API_URL;

function makeUser() {
  return {
    uid: 'owner',
    getIdToken: jest.fn(async (forceRefresh?: boolean) =>
      forceRefresh ? 'fresh-token' : 'cached-token',
    ),
  } as unknown as User;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_PHOTO_API_URL = 'https://worker.example';
});

afterEach(() => {
  if (originalPhotoApiUrl === undefined) {
    delete process.env.EXPO_PUBLIC_PHOTO_API_URL;
  } else {
    process.env.EXPO_PUBLIC_PHOTO_API_URL = originalPhotoApiUrl;
  }
});

describe('requestAccountDataDeletion', () => {
  it('fails cleanly when the worker API URL is missing', async () => {
    delete process.env.EXPO_PUBLIC_PHOTO_API_URL;
    await expect(
      requestAccountDataDeletion(makeUser(), jest.fn() as unknown as typeof fetch),
    ).rejects.toMatchObject({ code: 'account/delete-unavailable' });
  });

  it('completes single-pass deletion with a freshly refreshed token', async () => {
    const user = makeUser();
    const fetchMock = jest.fn(async () =>
      new Response(
        JSON.stringify({
          deleted: true,
          hasMore: false,
          deletedProviderIds: ['srv-1', 'srv-2'],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const result = await requestAccountDataDeletion(user, fetchMock);
    expect(result).toEqual({ deletedProviderIds: ['srv-1', 'srv-2'] });
    expect(user.getIdToken).toHaveBeenCalledTimes(1);
    expect(user.getIdToken).toHaveBeenCalledWith(true);
    expect(fetchMock).toHaveBeenCalledWith('https://worker.example/v1/account', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer fresh-token' },
    });
  });

  it('loops across multiple passes and aggregates unique deleted provider IDs', async () => {
    const user = makeUser();
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(async () =>
        new Response(
          JSON.stringify({
            deleted: false,
            hasMore: true,
            deletedProviderIds: ['srv-1', 'srv-2'],
          }),
          { status: 200 },
        ),
      )
      .mockImplementationOnce(async () =>
        new Response(
          JSON.stringify({
            deleted: true,
            hasMore: false,
            deletedProviderIds: ['srv-2', 'srv-3'],
          }),
          { status: 200 },
        ),
      ) as unknown as typeof fetch;

    const result = await requestAccountDataDeletion(user, fetchMock);
    expect(result).toEqual({ deletedProviderIds: ['srv-1', 'srv-2', 'srv-3'] });
    expect(jest.mocked(user.getIdToken).mock.calls).toEqual([[true], [false]]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    [401, { error: 'Recent login required' }, 'auth/requires-recent-login'],
    [401, { error: 'Invalid or expired authentication' }, 'auth/user-token-expired'],
    [403, { error: 'Admin accounts cannot be deleted directly' }, 'account/admin-cannot-delete'],
    [403, { error: 'Forbidden' }, 'permission-denied'],
    [404, { error: 'Endpoint not found' }, 'account/delete-unavailable'],
    [500, { error: 'Service unavailable' }, 'unavailable'],
  ])(
    'maps HTTP %s error responses to %s',
    async (status, body, expectedCode) => {
      const fetchMock = jest.fn(async () =>
        new Response(JSON.stringify(body), { status }),
      ) as unknown as typeof fetch;

      await expect(
        requestAccountDataDeletion(makeUser(), fetchMock),
      ).rejects.toMatchObject({ code: expectedCode });
    },
  );

  it('fails with account/delete-incomplete if hasMore persists beyond max passes', async () => {
    const fetchMock = jest.fn(async () =>
      new Response(
        JSON.stringify({ deleted: false, hasMore: true, deletedProviderIds: [] }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    await expect(
      requestAccountDataDeletion(makeUser(), fetchMock),
    ).rejects.toMatchObject({ code: 'account/delete-incomplete' });
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });
});
