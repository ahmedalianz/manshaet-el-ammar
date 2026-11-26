import { describe, expect, it } from '@jest/globals';
import {
  fromStoredValues,
  mapCategory,
  mapPlacePhoto,
  mapOwnedProvider,
  mapRequest,
  storedValuesMatch,
  timestampISO,
  toStoredValues,
} from '../src/features/provider/firebaseMapping';
const values = {
  name: 'أحمد',
  categoryId: 'plumbing',
  serviceTitle: 'سباك',
  description: '',
  phone: '٠١٠١٢٣٤٥٦٧٨',

  address: 'شارع المدرسة',
};
const timestamp = { toDate: () => new Date('2026-11-04T12:00:00Z') };
describe('Firestore mapping boundaries', () => {
  it('omits legacy location fields and normalizes phone digits', () => {
    const stored = toStoredValues(values);
    expect(stored).not.toHaveProperty('areaId');
    expect(stored).not.toHaveProperty('area');
    expect(stored.phone).toBe('01012345678');
    expect(fromStoredValues(stored)).toEqual({
      ...values,
      phone: '01012345678',
    });
  });
  it('ignores obsolete fields in legacy reads and rejects unbounded text', () => {
    expect(
      fromStoredValues({ ...toStoredValues(values), areaId: 'unknown' }),
    ).not.toHaveProperty('area');
    expect(() =>
      toStoredValues({ ...values, name: 'x'.repeat(101) }),
    ).toThrow();
  });
  it('uses only known category icons and never creates fallback business data', () => {
    expect(
      mapCategory('new-category', {
        active: true,
        name: 'قسم',
        description: '',
        icon: 'invalid-icon',
      }).icon,
    ).toBe('briefcase-outline');
    expect(
      mapCategory('tailoring', {
        active: true,
        name: 'الخياطة والتطريز',
        description: '',
        icon: 'needle',
      }).icon,
    ).toBe('content-cut');
    expect(() =>
      mapCategory('plumbing', { active: false, name: 'قسم' }),
    ).toThrow();
  });
  it('rejects a foreign owner before creating an owner listing', () => {
    expect(() =>
      mapOwnedProvider(
        'id',
        { ...toStoredValues(values), ownerId: 'foreign' },
        'owner',
      ),
    ).toThrow();
  });
  it('maps typed request snapshots and rejects invalid timestamps', () => {
    const request = mapRequest(
      'r',
      {
        ownerId: 'owner',
        providerId: 'p',
        type: 'create',
        status: 'pending',
        proposedData: toStoredValues(values),
        createdAt: timestamp,
      },
      'owner',
    );
    expect(request.createdAt).toBe('2026-11-04T12:00:00.000Z');
    expect(() => timestampISO('not a Firestore timestamp')).toThrow();
  });
  it('matches retries only for the same normalized proposal', () => {
    const stored = toStoredValues(values);
    expect(storedValuesMatch(stored, stored)).toBe(true);
    expect(
      storedValuesMatch({ ...stored, serviceTitle: 'مختلف' }, stored),
    ).toBe(false);
    expect(
      storedValuesMatch(
        { ...stored, location: { latitude: 30, longitude: 31 } },
        stored,
      ),
    ).toBe(false);
  });
});

describe('approved place photo mapping', () => {
  const photo = {
    version: 'v1',
    thumbnailUrl: 'https://res.cloudinary.com/sx5exugy/image/upload/thumb.jpg',
    detailUrl: 'https://res.cloudinary.com/sx5exugy/image/upload/detail.jpg',
    width: 1280,
    height: 960,
  };
  it('accepts approved Cloudinary metadata and rejects foreign hosts', () => {
    expect(mapPlacePhoto(photo)).toEqual(photo);
    expect(mapPlacePhoto(undefined)).toBeUndefined();
    expect(() =>
      mapPlacePhoto({ ...photo, detailUrl: 'https://evil.example/image.jpg' }),
    ).toThrow();
    expect(() => mapPlacePhoto({ ...photo, width: -1 })).toThrow();
  });
  it('does not leak proposed photo changes into the public service values', () => {
    expect(
      toStoredValues({
        ...values,
        photoChange: { action: 'replace', candidateId: 'candidate' },
      }),
    ).not.toHaveProperty('photoChange');
  });
});

it('requires the expected image version for photo removal and preserves it', () => {
  const stored = {
    ownerId: 'owner',
    providerId: 'p',
    type: 'update',
    status: 'pending',
    proposedData: toStoredValues(values),
    createdAt: timestamp,
    photoReviewStatus: 'pending',
    photoChange: { action: 'remove', expectedPhotoVersion: 'version1' },
  };
  expect(mapRequest('r', stored, 'owner').photoChange).toEqual(
    stored.photoChange,
  );
  expect(() =>
    mapRequest('r', { ...stored, photoChange: { action: 'remove' } }, 'owner'),
  ).toThrow();
  expect(
    mapRequest(
      'r',
      {
        ...stored,
        photoChange: { action: 'remove', expectedPhotoVersion: null },
      },
      'owner',
    ).photoChange?.expectedPhotoVersion,
  ).toBeNull();
});

it('maps photoReviewedAt from ISO strings and Firestore timestamps', () => {
  const base = {
    ownerId: 'owner',
    providerId: 'p',
    type: 'update',
    status: 'pending',
    proposedData: toStoredValues(values),
    createdAt: timestamp,
    photoReviewStatus: 'approved',
  };
  expect(
    mapRequest(
      'r1',
      { ...base, photoReviewedAt: '2026-11-17T12:00:00.000Z' },
      'owner',
    ).photoReviewedAt,
  ).toBe('2026-11-17T12:00:00.000Z');
  expect(
    mapRequest('r2', { ...base, photoReviewedAt: timestamp }, 'owner')
      .photoReviewedAt,
  ).toBe('2026-11-04T12:00:00.000Z');
  expect(() =>
    mapRequest('r3', { ...base, photoReviewedAt: 'invalid-date' }, 'owner'),
  ).toThrow();
});
