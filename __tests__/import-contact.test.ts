import { jest, beforeEach, it, expect } from "@jest/globals";

import { Contact, requestPermissionsAsync } from 'expo-contacts';
import { pickServiceContact } from '../src/features/provider/importContact';
jest.mock('expo-contacts', () => ({
  ContactField: { FULL_NAME: 'fullName', PHONES: 'phones' },
  Contact: { presentPicker: jest.fn() },
  requestPermissionsAsync: jest.fn(),
}));

beforeEach(() => {
  jest.resetAllMocks();
  (requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true } as never);
});
it('normalizes, filters and deduplicates selected contact numbers', async () => {
  (Contact.presentPicker as jest.Mock).mockResolvedValue({ getDetails: async () => ({
    fullName: ' أحمد ', phones: [{ number: '+20 1012345678' }, { number: '01012345678' }, { number: '123' }],
  }) } as never);
  expect(await pickServiceContact()).toEqual({ name: 'أحمد', phones: ['01012345678'] });
});
it('preserves cancellation', async () => {
  (Contact.presentPicker as jest.Mock).mockResolvedValue(null as never);
  expect(await pickServiceContact()).toBeNull();
});
it('reports denied access without opening the picker', async () => {
  (requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false } as never);
  await expect(pickServiceContact()).rejects.toThrow('إعدادات');
  expect(Contact.presentPicker).not.toHaveBeenCalled();
});
