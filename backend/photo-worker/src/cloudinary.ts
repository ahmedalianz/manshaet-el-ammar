import { boundedBody, type Env, HttpError } from './platform.ts';
export type Asset = {
  publicId: string;
  deliveryType: 'authenticated' | 'upload';
};
export type Photo = {
  version: string;
  thumbnailUrl: string;
  detailUrl: string;
  width: number;
  height: number;
};
const digest = async (text: string) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text)),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
export function jpegDimensions(bytes: Uint8Array): {
  width: number;
  height: number;
} {
  if (bytes[0] !== 255 || bytes[1] !== 216)
    throw new HttpError(415, 'JPEG images only');
  let offset = 2;
  while (offset + 1 < bytes.length) {
    if (bytes[offset++] !== 255) throw new HttpError(415, 'Malformed JPEG');
    while (offset < bytes.length && bytes[offset] === 255) offset++;
    if (offset >= bytes.length) throw new HttpError(415, 'Malformed JPEG');
    const marker = bytes[offset++];
    if (marker === 218 || marker === 217) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) continue;
    if (offset + 2 > bytes.length) throw new HttpError(415, 'Malformed JPEG');
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length)
      throw new HttpError(415, 'Malformed JPEG');
    if ([192, 193, 194].includes(marker)) {
      if (length < 8 || offset + 6 >= bytes.length)
        throw new HttpError(415, 'Malformed JPEG');
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4],
        width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      if (!width || !height || width > 1280 || height > 1280)
        throw new HttpError(400, 'Image must be at most 1280 pixels');
      return { width, height };
    }
    offset += length;
  }
  throw new HttpError(415, 'Unsupported JPEG');
}
export class Cloudinary {
  private env: Env;
  constructor(env: Env) {
    this.env = env;
  }
  private get cloudName() {
    return (this.env.CLOUDINARY_CLOUD_NAME || '').trim();
  }
  private get apiKey() {
    return (this.env.CLOUDINARY_API_KEY || '').trim();
  }
  private get apiSecret() {
    return (this.env.CLOUDINARY_API_SECRET || '').trim();
  }
  async api(action: string, params: Record<string, string>, file?: Uint8Array) {
    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      console.error('cloudinary-missing-credentials', {
        hasCloudName: Boolean(this.cloudName),
        hasApiKey: Boolean(this.apiKey),
        hasApiSecret: Boolean(this.apiSecret),
      });
      throw new HttpError(502, 'Image host operation failed');
    }
    const values = {
      ...params,
      timestamp: String(Math.floor(Date.now() / 1000)),
    };
    const signature = await digest(
      Object.entries(values)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('&') + this.apiSecret,
    );
    const form = new FormData();
    for (const [k, v] of Object.entries(values)) form.set(k, v);
    form.set('api_key', this.apiKey);
    form.set('signature', signature);
    if (file)
      form.set(
        'file',
        new Blob([file as BlobPart], { type: 'image/jpeg' }),
        'place.jpg',
      );
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName}/image/${action}`,
      { method: 'POST', body: form },
    );
    const data = (await response.json().catch(() => ({}))) as any;
    if (!response.ok) {
      console.error('cloudinary-api-error', {
        action,
        status: response.status,
        cldError: response.headers.get('x-cld-error'),
        message: data?.error?.message,
      });
      throw new HttpError(502, 'Image host operation failed');
    }
    return data;
  }
  async upload(
    publicId: string,
    bytes: Uint8Array,
    type: 'authenticated' | 'upload',
    maxBytes = 500_000,
  ) {
    const data = await this.api(
      'upload',
      {
        public_id: publicId,
        type,
        format: 'jpg',
        overwrite: 'false',
        unique_filename: 'false',
        ...(type === 'authenticated'
          ? {
              transformation: 'c_limit,w_1280,h_1280/q_80,fl_strip_profile',
            }
          : {}),
      },
      bytes,
    );
    if (
      data.public_id !== publicId ||
      data.type !== type ||
      data.resource_type !== 'image' ||
      data.format !== 'jpg' ||
      !data.width ||
      !data.height ||
      data.width > 1280 ||
      data.height > 1280 ||
      typeof data.bytes !== 'number' ||
      data.bytes > maxBytes
    ) {
      await this.destroy({ publicId, deliveryType: type }).catch(() => {});
      const oversized = typeof data.bytes === 'number' && data.bytes > maxBytes;
      throw new HttpError(
        oversized ? 422 : 415,
        oversized ? 'Image exceeds size limit' : 'Image validation failed',
      );
    }
    return data;
  }
  async privateBytes(publicId: string, transformation = 'f_jpg,q_80') {
    const unsigned = `${transformation}/${publicId}.jpg`;
    const hash = await crypto.subtle.digest(
      'SHA-1',
      new TextEncoder().encode(unsigned + this.apiSecret),
    );
    const signature = btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .slice(0, 8);
    const url = `https://res.cloudinary.com/${this.cloudName}/image/authenticated/s--${signature}--/${unsigned}`;
    const response = await fetch(url, { cf: { cacheTtl: 0 } } as RequestInit);
    if (!response.ok) {
      console.error('cloudinary-private-fetch-error', {
        status: response.status,
        cldError: response.headers.get('x-cld-error'),
      });
      throw new HttpError(502, 'Private image unavailable');
    }
    return boundedBody(response, 500000);
  }
  async derivatives(
    publicId: string,
    version: string,
  ): Promise<{ photo: Photo; assets: Asset[] }> {
    const assets: Asset[] = [];
    try {
      const thumbnail = await this.fit(publicId, [
        ['c_fill,w_480,h_360,g_center/f_jpg,q_75', 80_000],
        ['c_fill,w_400,h_300,g_center/f_jpg,q_70', 80_000],
        ['c_fill,w_320,h_240,g_center/f_jpg,q_55', 80_000],
        ['c_fill,w_240,h_180,g_center/f_jpg,q_40', 80_000],
      ]);
      const detail = await this.fit(publicId, [
        ['c_limit,w_1280,h_1280/f_jpg,q_82', 300_000],
        ['c_limit,w_1280,h_1280/f_jpg,q_72', 300_000],
        ['c_limit,w_1024,h_1024/f_jpg,q_60', 300_000],
        ['c_limit,w_800,h_800/f_jpg,q_45', 300_000],
      ]);
      const thumbId = `service-photos/public/${version}/thumbnail`,
        detailId = `service-photos/public/${version}/detail`;
      assets.push({ publicId: thumbId, deliveryType: 'upload' });
      const t = await this.upload(thumbId, thumbnail, 'upload', 80_000);
      assets.push({ publicId: detailId, deliveryType: 'upload' });
      const d = await this.upload(detailId, detail, 'upload', 300_000);
      return {
        photo: {
          version,
          thumbnailUrl: t.secure_url,
          detailUrl: d.secure_url,
          width: d.width,
          height: d.height,
        },
        assets,
      };
    } catch (error) {
      for (const asset of assets) await this.destroy(asset).catch(() => {});
      throw error;
    }
  }
  async fit(publicId: string, options: [string, number][]) {
    for (const [transformation, limit] of options) {
      const bytes = await this.privateBytes(publicId, transformation);
      if (bytes.byteLength <= limit) return bytes;
    }
    throw new HttpError(422, 'Unable to optimize image within size limit');
  }
  async destroy(asset: Asset) {
    return this.api('destroy', {
      public_id: asset.publicId,
      type: asset.deliveryType,
      invalidate: 'true',
    });
  }
  async listResources(
    deliveryType: 'authenticated' | 'upload',
    nextCursor?: string,
    maxResults = 5,
  ): Promise<{
    resources: { public_id: string; created_at?: string }[];
    next_cursor?: string;
  }> {
    const query = new URLSearchParams({
      prefix: 'service-photos/',
      max_results: String(maxResults),
      ...(nextCursor ? { next_cursor: nextCursor } : {}),
    });
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName}/resources/image/${deliveryType}?${query.toString()}`,
      {
        headers: {
          Authorization: `Basic ${btoa(`${this.apiKey}:${this.apiSecret}`)}`,
        },
      },
    );
    if (!response.ok) throw new HttpError(502, 'Image listing failed');
    const data = (await response.json()) as {
      resources?: { public_id: string; created_at?: string }[];
      next_cursor?: string;
    };
    return {
      resources: Array.isArray(data.resources) ? data.resources : [],
      ...(data.next_cursor ? { next_cursor: data.next_cursor } : {}),
    };
  }
}
