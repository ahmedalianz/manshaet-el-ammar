import { beforeEach, expect, it, jest } from '@jest/globals';
const mockToken = jest.fn<() => Promise<string>>();
const mockAuth: { currentUser: { getIdToken: typeof mockToken } | null } = {
  currentUser: { getIdToken: mockToken },
};
jest.mock('../src/lib/firebase/auth', () => ({ auth: mockAuth }));
const mockFetch = jest.fn<typeof fetch>();
beforeEach(() => {
  process.env.EXPO_PUBLIC_PHOTO_API_URL = 'https://photos.example.test';
  mockAuth.currentUser = { getIdToken: mockToken };
  mockToken.mockResolvedValue('firebase-owner-token');
  global.fetch = mockFetch;
});
it('sends the Firebase token to the configured backend only', async () => {
  jest.resetModules();
  const { photoRequest } = jest.requireActual<
    typeof import('../src/features/photos/api')
  >('../src/features/photos/api');
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ candidateId: 'candidate-1' }),
  } as Response);
  await expect(
    photoRequest('/v1/photos/reservations', {
      method: 'POST',
      body: JSON.stringify({ serviceId: 'service-1' }),
    }),
  ).resolves.toEqual({ candidateId: 'candidate-1' });
  expect(mockFetch).toHaveBeenCalledWith(
    'https://photos.example.test/v1/photos/reservations',
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer firebase-owner-token',
      }),
    }),
  );
});
it('rejects unauthenticated requests before network transmission', async () => {
  jest.resetModules();
  mockAuth.currentUser = null;
  const { photoRequest } = jest.requireActual<
    typeof import('../src/features/photos/api')
  >('../src/features/photos/api');
  await expect(photoRequest('/v1/photos/reservations')).rejects.toThrow();
  expect(mockFetch).not.toHaveBeenCalled();
});
it('rejects oversized photo bytes before creating an upload request', async () => {
  jest.resetModules();
  const { uploadPhoto } = jest.requireActual<
    typeof import('../src/features/photos/api')
  >('../src/features/photos/api');
  mockFetch.mockResolvedValue({
    blob: async () => ({ size: 500001 }),
  } as Response);
  await expect(
    uploadPhoto(
      'candidate-1',
      'file:///image.jpg',
      jest.fn(),
      new AbortController().signal,
    ),
  ).rejects.toThrow('الصورة كبيرة');
});

it('maps Worker HTTP error statuses to localized Arabic messages without raw English leaks', async () => {
  jest.resetModules();
  const { photoErrorMessage, photoRequest } = jest.requireActual<
    typeof import('../src/features/photos/api')
  >('../src/features/photos/api');
  for (const [status, raw, expectedPattern] of [
    [401, 'Invalid token', /جلستك انتهت/],
    [403, 'Not your service', /مش مسموح/],
    [404, 'Photo not found', /مبقتش متاحة/],
    [404, 'Endpoint not found', /محتاجة تحديث/],
    [404, 'Service not found', /مش موجودة في الدليل/],
    [409, 'An existing photo is awaiting review', /قيد المراجعة/],
    [409, 'Service limit reached', /للحد الأقصى/],
    [409, 'Photo changed on another device', /اتحدّثت/],
    [413, 'File too large', /٥٠٠ كيلوبايت/],
    [415, 'JPEG images only', /مش مدعومة/],
    [422, 'Image exceeds size limit', /مش مدعومة/],
    [429, 'Daily upload limit reached', /١٠ محاولات/],
    [503, 'Photo uploads are not enabled', /متوقف مؤقتًا/],
    [503, 'Photo processing paused', /معالجة الصور متوقفة/],
  ] as const) {
    const localized = photoErrorMessage(status, raw);
    expect(localized).toMatch(expectedPattern);
    expect(localized).not.toMatch(/[A-Za-z]/);
  }
  mockFetch.mockResolvedValue({
    ok: false,
    status: 429,
    json: async () => ({ error: 'Daily upload limit reached' }),
  } as Response);
  await expect(
    photoRequest('/v1/photos/reservations', { method: 'POST', body: '{}' }),
  ).rejects.toThrow('وصلت للحد اليومي لرفع الصور');
});

it('normalizes bare hostnames and strips trailing slashes in getPhotoApiUrl', () => {
  const previous = process.env.EXPO_PUBLIC_PHOTO_API_URL;
  try {
    const { getPhotoApiUrl } = jest.requireActual<
      typeof import('../src/features/photos/api')
    >('../src/features/photos/api');
    process.env.EXPO_PUBLIC_PHOTO_API_URL =
      'ammar-service-photos.manshaet-el-ammar.workers.dev/';
    expect(getPhotoApiUrl()).toBe(
      'https://ammar-service-photos.manshaet-el-ammar.workers.dev',
    );
    process.env.EXPO_PUBLIC_PHOTO_API_URL = 'localhost:8787/';
    expect(getPhotoApiUrl()).toBe('http://localhost:8787');
    process.env.EXPO_PUBLIC_PHOTO_API_URL = 'https://example.workers.dev///';
    expect(getPhotoApiUrl()).toBe('https://example.workers.dev');
    process.env.EXPO_PUBLIC_PHOTO_API_URL = '   ';
    expect(getPhotoApiUrl()).toBeUndefined();
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_PHOTO_API_URL;
    else process.env.EXPO_PUBLIC_PHOTO_API_URL = previous;
  }
});
