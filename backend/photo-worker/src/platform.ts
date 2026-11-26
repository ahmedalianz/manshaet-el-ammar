import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose';

export interface Env {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  UPLOADS_ENABLED: string;
  ALLOWED_ORIGINS?: string;
  USAGE_ALERT_WEBHOOK?: string;
}
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export const id = (value: unknown) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value))
    throw new HttpError(400, 'Invalid identifier');
  return value;
};
const firebaseKeys = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  ),
);
export async function authenticate(request: Request, env: Env) {
  const token = request.headers
    .get('Authorization')
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, 'Authentication required');
  try {
    const { payload } = await jwtVerify(token, firebaseKeys, {
      algorithms: ['RS256'],
      audience: env.FIREBASE_PROJECT_ID,
      issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
    });
    if (
      !payload.sub ||
      payload.sub.length > 128 ||
      typeof payload.auth_time !== 'number' ||
      payload.auth_time > Date.now() / 1000 + 60
    )
      throw new Error('Invalid claims');
    return {
      uid: payload.sub,
      admin: payload.admin === true,
      authTime: payload.auth_time,
    };
  } catch {
    throw new HttpError(401, 'Invalid or expired authentication');
  }
}
let accessCache: { email: string; token: string; expires: number } | undefined;
async function accessToken(env: Env) {
  const clientEmail = env.FIREBASE_CLIENT_EMAIL.trim();
  if (
    accessCache?.email === clientEmail &&
    accessCache.expires > Date.now() + 60000
  )
    return accessCache.token;
  const key = await importPKCS8(
    env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').trim(),
    'RS256',
  );
  const assertion = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/datastore',
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(clientEmail)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!response.ok || !data.access_token)
    throw new HttpError(503, 'Database authentication unavailable');
  accessCache = {
    email: clientEmail,
    token: data.access_token,
    expires: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return data.access_token;
}
type Value = {
  nullValue?: null;
  stringValue?: string;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  arrayValue?: { values?: Value[] };
  mapValue?: { fields?: Record<string, Value> };
  timestampValue?: string;
  referenceValue?: string;
};
export function encode(value: unknown): Value {
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number')
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  if (Array.isArray(value))
    return { arrayValue: { values: value.map(encode) } };
  return {
    mapValue: {
      fields: Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, encode(v)]),
      ),
    },
  };
}
export function decode(value: Value): unknown {
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value)
    return (value.arrayValue?.values || []).map(decode);
  return Object.fromEntries(
    Object.entries(value.mapValue?.fields || {}).map(([k, v]) => [
      k,
      decode(v),
    ]),
  );
}
export type Doc = Record<string, any>;
export class Store {
  base: string;
  private env: Env;
  constructor(env: Env) {
    this.env = env;
    this.base = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  }
  name(path: string) {
    return `projects/${this.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;
  }
  async call(path: string, body?: unknown, method = body ? 'POST' : 'GET') {
    const response = await fetch(this.base + path, {
      method,
      headers: {
        Authorization: `Bearer ${await accessToken(this.env)}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 404) return null;
    const data = (await response.json()) as any;
    if (!response.ok) {
      if (response.status === 409 || data.error?.status === 'ABORTED')
        throw new HttpError(409, 'Concurrent update; retry');
      throw new HttpError(503, 'Database operation failed');
    }
    return data;
  }
  async get(path: string, tx?: string): Promise<Doc | null> {
    const doc = await this.call(
      '/' + path + (tx ? `?transaction=${encodeURIComponent(tx)}` : ''),
    );
    return doc
      ? (decode({ mapValue: { fields: doc.fields || {} } }) as Doc)
      : null;
  }
  write(path: string, data: Doc, merge = false) {
    return {
      update: { name: this.name(path), fields: encode(data).mapValue!.fields },
      ...(merge ? { updateMask: { fieldPaths: Object.keys(data) } } : {}),
    };
  }
  deleteWrite(path: string) {
    return { delete: this.name(path) };
  }
  async commit(writes: any[]) {
    if (writes.length === 0) return;
    for (let i = 0; i < writes.length; i += 400) {
      await this.call(':commit', { writes: writes.slice(i, i + 400) });
    }
  }
  async transaction<T>(
    work: (tx: string, writes: any[]) => Promise<T>,
  ): Promise<T> {
    const tx = (await this.call(':beginTransaction', {})).transaction;
    const writes: any[] = [];
    try {
      const result = await work(tx, writes);
      await this.call(':commit', { transaction: tx, writes });
      return result;
    } catch (error) {
      await this.call(':rollback', { transaction: tx }).catch(() => {});
      throw error;
    }
  }
  async put(path: string, data: Doc, merge = false) {
    await this.call(':commit', { writes: [this.write(path, data, merge)] });
  }
  async list(
    collection: string,
    field?: string,
    op = 'EQUAL',
    value?: unknown,
    cursor?: string,
    maximum = 50,
  ) {
    const query: any = {
      from: [{ collectionId: collection }],
      limit: maximum,
      orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }],
    };
    if (cursor)
      query.startAt = {
        values: [{ referenceValue: this.name(`${collection}/${id(cursor)}`) }],
        before: false,
      };
    if (field)
      query.where = {
        fieldFilter: { field: { fieldPath: field }, op, value: encode(value) },
      };
    const data = await this.call(':runQuery', { structuredQuery: query });
    return (data || [])
      .filter((x: any) => x.document)
      .map((x: any) => ({
        id: x.document.name.split('/').at(-1),
        ...(decode({ mapValue: { fields: x.document.fields || {} } }) as Doc),
      }));
  }
}
export async function boundedBody(
  request: Request | Response,
  maximum: number,
) {
  if (Number(request.headers.get('content-length') || 0) > maximum)
    throw new HttpError(413, 'File too large');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Empty body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximum) {
      await reader.cancel();
      throw new HttpError(413, 'File too large');
    }
    chunks.push(value);
  }
  const output = new Uint8Array(size);
  let position = 0;
  for (const chunk of chunks) {
    output.set(chunk, position);
    position += chunk.length;
  }
  return output;
}
