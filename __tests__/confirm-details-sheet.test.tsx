import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from './helpers/render';
import { ConfirmDetailsAction } from '../src/features/provider/ConfirmDetailsAction';
import { providers } from './fixtures/providers';
import type { ServiceProvider } from '../src/features/discovery/types';
const mockFetch = jest.fn<() => Promise<ServiceProvider | null>>();
const mockConfirm = jest.fn<(id: string, updatedAt: string) => Promise<void>>();
const mockShow = jest.fn();
jest.mock('../src/features/provider/firebaseRepository', () => ({
  fetchProvider: () => mockFetch(),
}));
jest.mock('../src/lib/firebase/firestore', () => ({ db: {} }));
jest.mock('../src/features/provider/ProviderContext', () => ({
  useProviderState: () => ({ confirmDetails: mockConfirm }),
}));
jest.mock('../src/components/ui/Feedback', () => ({
  useFeedback: () => ({ show: mockShow }),
}));
const fresh = {
  ...providers[0],
  updatedAt: '2026-11-13T10:00:00Z',
  name: 'بيانات حديثة',
  phone: '01012345678',
};
const listing = {
  ...fresh,
  ownerId: 'owner',
  name: 'بيانات قديمة',
  lastConfirmedAt: undefined,
};
beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue(fresh);
  mockConfirm.mockResolvedValue();
});
it('shows fresh labelled details and confirms the reviewed version only after approval', async () => {
  await render(<ConfirmDetailsAction listing={listing} />);
  await fireEvent.press(
    screen.getByRole('button', { name: 'راجع وأكّد البيانات' }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole('header', { name: 'البيانات دي لسه صحيحة؟' }),
    ).toBeTruthy(),
  );
  expect(screen.getByText('بيانات حديثة')).toBeTruthy();
  expect(screen.getByText('رقم الموبايل')).toBeTruthy();
  expect(mockConfirm).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole('button', { name: 'أيوه، البيانات لسه صحيحة' }),
  );
  await waitFor(() =>
    expect(mockConfirm).toHaveBeenCalledWith(fresh.id, fresh.updatedAt),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole('header', { name: 'البيانات دي لسه صحيحة؟' }),
    ).toBeNull(),
  );
  expect(mockShow).toHaveBeenCalledWith('تم التأكيد', expect.any(String));
});
it('keeps the sheet available for retry and blocks cached data', async () => {
  mockConfirm.mockRejectedValueOnce(new Error('حاول تاني'));
  await render(<ConfirmDetailsAction listing={listing} />);
  await fireEvent.press(
    screen.getByRole('button', { name: 'راجع وأكّد البيانات' }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'أيوه، البيانات لسه صحيحة' }),
    ).toBeTruthy(),
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'أيوه، البيانات لسه صحيحة' }),
  );
  await waitFor(() =>
    expect(mockShow).toHaveBeenCalledWith(
      'مش قادرين نأكد البيانات',
      'حاول تاني',
    ),
  );
  expect(
    screen.getByRole('header', { name: 'البيانات دي لسه صحيحة؟' }),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'رجوع' }));
  mockFetch.mockResolvedValue({ ...fresh, cachedAt: '2026-11-13T10:00:00Z' });
  await fireEvent.press(
    screen.getByRole('button', { name: 'راجع وأكّد البيانات' }),
  );
  await waitFor(() =>
    expect(mockShow).toHaveBeenCalledWith(
      'مش قادرين نعرض البيانات',
      expect.any(String),
    ),
  );
  expect(
    screen.queryByRole('header', { name: 'البيانات دي لسه صحيحة؟' }),
  ).toBeNull();
});
