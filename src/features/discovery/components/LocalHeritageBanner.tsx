import { Image, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../theme/ThemeProvider';

const banner = require('../../../../assets/images/local-heritage-banner.png');

export function LocalHeritageBanner() {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.card, { borderColor: colors.border }]}>
      <Image
        accessible
        source={banner}
        resizeMode="cover"
        accessibilityRole="image"
        accessibilityLabel="مِنْ أَهْلِ البَلَد، لِأَهْلِ البَلَد. بلدنا أقرب. كل خدمة وراها حد مننا."
        style={styles.artwork}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    aspectRatio: 2.8,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  artwork: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
});
