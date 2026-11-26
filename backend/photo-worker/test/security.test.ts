import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  boundedBody,
  decode,
  encode,
  HttpError,
  id,
  type Env,
} from '../src/platform.ts';
import { Cloudinary, jpegDimensions } from '../src/cloudinary.ts';
import { handle } from '../src/index.ts';
const env: Env = {
  FIREBASE_PROJECT_ID: 'demo-ammar',
  FIREBASE_CLIENT_EMAIL: '',
  FIREBASE_PRIVATE_KEY: '',
  CLOUDINARY_CLOUD_NAME: 'test',
  CLOUDINARY_API_KEY: '',
  CLOUDINARY_API_SECRET: '',
  UPLOADS_ENABLED: 'false',
};
test('rejects path traversal and unbounded identifiers', () => {
  for (const value of ['../owner', 'a/b', '', null, 'x'.repeat(129)])
    assert.throws(() => id(value), HttpError);
  assert.equal(id('provider-safe_123'), 'provider-safe_123');
});
test('Firestore codec preserves timestamps used by the app', () => {
  const date = new Date('2026-11-17T12:00:00Z');
  assert.deepEqual(encode(date), { timestampValue: date.toISOString() });
  const value = {
    placePhoto: null,
    limit: 10,
    enabled: true,
    items: ['a'],
    nested: { id: 'safe' },
  };
  assert.deepEqual(decode(encode(value)), value);
});
test('bounded streaming upload rejects missing content length too', async () => {
  const request = new Request('https://worker.test', {
    method: 'PUT',
    body: new Uint8Array(51),
  });
  await assert.rejects(
    boundedBody(request, 50),
    (error) => error instanceof HttpError && error.status === 413,
  );
});
test('bounded reader allows an exact limit', async () => {
  assert.equal(
    (
      await boundedBody(
        new Request('https://worker.test', {
          method: 'PUT',
          body: new Uint8Array(50),
        }),
        50,
      )
    ).length,
    50,
  );
});
function jpeg(width: number, height: number) {
  return new Uint8Array([
    255,
    216,
    255,
    192,
    0,
    17,
    8,
    height >> 8,
    height & 255,
    width >> 8,
    width & 255,
    3,
    1,
    0,
    0,
    2,
    0,
    0,
    3,
    0,
    0,
    255,
    217,
  ]);
}
test('JPEG dimension gate accepts bounded baseline and rejects huge dimensions', () => {
  assert.deepEqual(jpegDimensions(jpeg(1280, 960)), {
    width: 1280,
    height: 960,
  });
  assert.throws(() => jpegDimensions(jpeg(4000, 3000)), HttpError);
  assert.throws(
    () => jpegDimensions(new Uint8Array([137, 80, 78, 71])),
    HttpError,
  );
  assert.throws(
    () => jpegDimensions(new Uint8Array([255, 216, 255, 192, 0, 0])),
    HttpError,
  );
  assert.throws(
    () => jpegDimensions(new Uint8Array([255, 216, 255, 192, 0, 5, 8, 0, 1])),
    (error) => error instanceof HttpError && error.status === 415,
  );
});
test('protected APIs never accept an absent Firebase token', async () => {
  const response = await handle(
    new Request('https://worker.test/v1/photos/reservations', {
      method: 'POST',
      body: '{}',
    }),
    env,
  );
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('DELETE /v1/account never accepts an absent Firebase token', async () => {
  const response = await handle(
    new Request('https://worker.test/v1/account', {
      method: 'DELETE',
    }),
    env,
  );
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('web CORS denies an unlisted origin before authentication', async () => {
  const response = await handle(
    new Request('https://worker.test/v1/photos/reservations', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.invalid' },
    }),
    env,
  );
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});
test('CORS allows an explicit web origin and authorization preflight', async () => {
  const response = await handle(
    new Request('https://worker.test/v1/photos/reservations', {
      method: 'OPTIONS',
      headers: { Origin: 'https://app.example' },
    }),
    { ...env, ALLOWED_ORIGINS: 'https://app.example' },
  );
  assert.equal(response.status, 204);
  assert.equal(
    response.headers.get('access-control-allow-origin'),
    'https://app.example',
  );
});
test('invalid tokens fail closed without exposing host credentials', async () => {
  const response = await handle(
    new Request('https://worker.test/v1/photos/candidates/other/preview', {
      headers: { Authorization: 'Bearer invalid' },
    }),
    env,
  );
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: 'Invalid or expired authentication',
  });
});

test('wrangler config does not contain plaintext service-account or API secrets', async () => {
  const wranglerConfig = await readFile(
    new URL('../wrangler.jsonc', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(
    wranglerConfig,
    /FIREBASE_PRIVATE_KEY|FIREBASE_CLIENT_EMAIL|CLOUDINARY_API_SECRET|BEGIN PRIVATE KEY/,
  );
});

test('Cloudinary upload uses top-level format=jpg without delivery-only f_jpg in incoming transformation', async () => {
  const originalFetch = globalThis.fetch;
  let capturedForm: FormData | undefined;
  let capturedUrl = '';
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedForm = init?.body as FormData;
    return Response.json({
      public_id: 'service-photos/private/u1/s1/c1',
      type: 'authenticated',
      resource_type: 'image',
      format: 'jpg',
      width: 800,
      height: 600,
      bytes: 120000,
      secure_url: 'https://res.cloudinary.com/test/image/authenticated/c1.jpg',
    });
  }) as typeof fetch;
  try {
    const cloud = new Cloudinary({
      ...env,
      CLOUDINARY_CLOUD_NAME: ' sx5exugy ',
      CLOUDINARY_API_KEY: ' 12345 ',
      CLOUDINARY_API_SECRET: ' secret-value \n',
    });
    await cloud.upload(
      'service-photos/private/u1/s1/c1',
      jpeg(800, 600),
      'authenticated',
    );
    assert.equal(
      capturedUrl,
      'https://api.cloudinary.com/v1_1/sx5exugy/image/upload',
    );
    assert.ok(capturedForm);
    assert.equal(capturedForm.get('format'), 'jpg');
    assert.equal(capturedForm.get('api_key'), '12345');
    const transformation = String(capturedForm.get('transformation') || '');
    assert.equal(transformation, 'c_limit,w_1280,h_1280/q_80,fl_strip_profile');
    assert.doesNotMatch(transformation, /\bf_jpg\b/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
