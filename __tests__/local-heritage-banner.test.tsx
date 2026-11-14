import { beforeEach, expect, it } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen } from './helpers/render';
import { LocalHeritageBanner } from '../src/features/discovery/components/LocalHeritageBanner';
import { THEME_STORAGE_KEY } from '../src/theme/ThemeProvider';

beforeEach(async () => {
  await AsyncStorage.clear();
});
it.each(['light', 'dark'] as const)(
  'renders the noninteractive heritage banner in the %s theme',
  async (theme) => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
    await render(<LocalHeritageBanner />);
    expect(
      screen.getByRole('image', {
        name: 'مِنْ أَهْلِ البَلَد، لِأَهْلِ البَلَد. بلدنا أقرب. كل خدمة وراها حد مننا.',
      }),
    ).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  },
);
