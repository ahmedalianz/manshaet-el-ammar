import { describe, expect, it } from '@jest/globals';
import {
  fromStoredValues,
  mapCategory,
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

  address: 'شارع المدارس',
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
