import { expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from './helpers/render';
import { useState } from 'react';
import { Text } from 'react-native';
import { SearchInput } from '../src/features/discovery/components/DiscoveryUi';

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
function Harness() {
  const [value, setValue] = useState('سباك');
  return (
    <>
      <SearchInput value={value} onChangeText={setValue} placeholder="ابحث" />
      <Text>{value ? 'filtered' : 'all results'}</Text>
    </>
  );
}
it('clears controlled query and results, then hides the accessible clear action', async () => {
  await render(<Harness />);
  expect(screen.getByLabelText('ابحث').props.textAlign).toBe('right');
  const clear = screen.getByRole('button', { name: 'مسح البحث' });
  expect(clear.props.style.minHeight).toBe(48);
  await fireEvent.press(clear);
  expect(screen.getByLabelText('ابحث').props.value).toBe('');
  expect(screen.getByText('all results')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'مسح البحث' })).toBeNull();
});
