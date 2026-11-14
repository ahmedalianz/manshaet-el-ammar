import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { useAppTheme } from '../../theme/ThemeProvider';

export function MyServicesEmptyArtwork() {
  const { colors, resolved } = useAppTheme();
  const dark = resolved === 'dark';
  const blue = dark ? '#83B8D6' : '#37748D';
  const sand = dark ? '#B79C77' : '#E4C393';
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.art}
    >
      <Svg width="100%" height="100%" viewBox="0 0 280 180" accessible={false}>
        <Circle cx="123" cy="86" r="75" fill={colors.surfaceContainer} />
        <G fill={blue} opacity=".16">
          <Path d="M217 136V91H229V136M219 91V80L223 70L227 80V91M234 136V116H245V105H260V136Z" />
        </G>
        <Rect x="81" y="60" width="124" height="102" rx="4" fill={sand} />
        <Path
          d="M81 64L66 76V161L81 162"
          fill={sand}
          stroke={blue}
          strokeWidth="1.5"
        />
        <Rect x="98" y="86" width="91" height="74" rx="2" fill={blue} />
        <G stroke={colors.primaryDark} strokeWidth="1" opacity=".5">
          <Path d="M99 98H188M99 110H188M99 122H188M99 134H188M99 146H188" />
        </G>
        <Path
          d="M81 60H205L216 81H75Z"
          fill={blue}
          stroke={colors.primaryDark}
          strokeWidth="1.5"
        />
        <Path
          d="M94 60L90 82H104L107 60M122 60L121 82H135L135 60M150 60L153 82H167L164 60M178 60L184 82H199L192 60"
          fill="#F8ECD9"
        />
        <Path
          d="M75 81V87Q83 97 91 87Q98 97 105 87Q113 97 121 87Q128 97 135 87Q143 97 151 87Q159 97 167 87Q175 97 183 87Q191 97 199 87Q208 97 216 87V81"
          fill={blue}
        />
        <Path d="M126 54V45M166 54V45" stroke={blue} strokeWidth="4" />
        <Rect
          x="112"
          y="14"
          width="68"
          height="36"
          rx="7"
          fill="#1C4260"
          stroke={sand}
          strokeWidth="2"
        />
        <G stroke={sand} strokeWidth="3" fill="none" strokeLinecap="round">
          <Path d="M137 39L157 22M132 22L154 40M132 22L133 28L138 29M157 22L157 28L152 28" />
        </G>
        <Path
          d="M188 16L190 7M197 23L204 16M201 32L210 30"
          stroke={sand}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <Path
          d="M60 153Q38 135 43 118Q63 121 66 143Q64 120 77 111Q89 126 68 151M61 152Q39 148 36 135Q52 130 61 152"
          fill="#819D75"
        />
        <Path d="M51 149H77L73 168H55Z" fill={blue} />
        <Path
          d="M19 166Q70 157 124 166T261 164Q209 178 142 172T19 166Z"
          fill={colors.border}
        />
      </Svg>
    </View>
  );
}
const styles = StyleSheet.create({
  art: { width: '100%', maxWidth: 280, height: 150, alignSelf: 'center' },
});
