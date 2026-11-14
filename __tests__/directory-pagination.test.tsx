import { expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from './helpers/render';
import { DirectoryPagination } from '../src/features/discovery/DirectoryPagination';
it('distinguishes loaded records, directory total and incomplete search matches', async () => {
  const retry = jest.fn<() => Promise<void>>().mockResolvedValue();
  const view = await render(
    <DirectoryPagination
      loaded={100}
      total={250}
      matches={0}
      searching
      hasMore
      error="offline"
      loadMore={retry}
    />,
  );
  expect(
    screen.getByText(/تم تحميل ١٠٠ خدمة · إجمالي الدليل ٢٥٠/),
  ).toBeTruthy();
  expect(screen.getByText(/البحث لم يكتمل بعد/)).toBeTruthy();
  expect(screen.queryByText(/في الدليل بالكامل/)).toBeNull();
  await fireEvent.press(
    screen.getByRole('button', { name: 'إعادة محاولة تحميل باقي الخدمات' }),
  );
  expect(retry).toHaveBeenCalledTimes(1);
  await view.rerender(
    <DirectoryPagination
      loaded={250}
      total={250}
      matches={1}
      searching
      hasMore={false}
    />,
  );
  expect(screen.getByText(/١ خدمة مطابقة في الدليل بالكامل/)).toBeTruthy();
});
it('does not substitute loaded count for an unavailable total', async () => {
  await render(<DirectoryPagination loaded={100} hasMore />);
  expect(screen.getByText(/إجمالي الدليل غير متاح حاليًا/)).toBeTruthy();
});
