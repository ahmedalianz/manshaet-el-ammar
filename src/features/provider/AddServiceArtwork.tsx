import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { useAppTheme } from '../../theme/ThemeProvider';

export type AddServiceArtworkVariant = 'step1' | 'step2' | 'photo' | 'review';

// Decorative illustrations for the Add/Edit Service flow; native text conveys all meaning.
export function AddServiceArtwork({
  variant,
  compact = false,
  style,
}: {
  variant: AddServiceArtworkVariant;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const id = useId();
  const backdropId = `${id}-backdrop`;
  const { colors, resolved } = useAppTheme();
  const dark = resolved === 'dark';

  const blue = dark ? '#6FC5D0' : '#37748D';
  const deepBlue = dark ? '#20475E' : '#28577A';
  const sand = dark ? '#B79C77' : '#E4C393';
  const sandSoft = dark ? '#453D31' : '#F8ECD9';
  const olive = dark ? '#7FA286' : '#738A68';
  const oliveLight = dark ? '#96B89D' : '#8BA980';
  const gold = '#F0B329';

  const sizeStyle =
    variant === 'photo'
      ? compact
        ? styles.photoCompact
        : styles.photoDefault
      : styles.bannerDefault;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[sizeStyle, style]}
    >
      {variant === 'step1' ? (
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 180 136"
          accessible={false}
        >
          <Defs>
            <LinearGradient id={backdropId} x1="0" y1="0" x2="1" y2="1">
              <Stop
                offset="0"
                stopColor={dark ? '#2A4E66' : '#CFE3F2'}
                stopOpacity={0.95}
              />
              <Stop
                offset="1"
                stopColor={dark ? '#1B3446' : '#F4EBDD'}
                stopOpacity={0.85}
              />
            </LinearGradient>
          </Defs>
          <Circle cx={92} cy={68} r={58} fill={`url(#${backdropId})`} />
          <G fill={blue} opacity={0.18}>
            <Path d="M18 106V78H31V106M145 106V71H158V106M148 71V61L151.5 53L155 61V71" />
          </G>
          <Path
            d="M22 114Q90 107 158 115Q92 124 22 114Z"
            fill={colors.border}
            opacity={0.75}
          />
          <Rect
            x={42}
            y={46}
            width={92}
            height={68}
            rx={6}
            fill={sand}
            stroke={deepBlue}
            strokeWidth={1.5}
          />
          <Path
            d="M42 46H134L142 63H34Z"
            fill={deepBlue}
            stroke={colors.primaryDark}
            strokeWidth={1.2}
          />
          <Path
            d="M52 46L48 63H60L62 46M73 46L71 63H83L84 46M95 46L96 63H108L106 46M117 46L121 63H133L127 46"
            fill={sandSoft}
          />
          <Path
            d="M34 63V67Q40.5 74 47 67Q53.5 74 60 67Q66.5 74 73 67Q79.5 74 86 67Q92.5 74 99 67Q105.5 74 112 67Q118.5 74 125 67Q133.5 74 142 67V63"
            fill={blue}
          />
          <Rect x={53} y={76} width={34} height={26} rx={4} fill={deepBlue} />
          <Path
            d="M59 83L67 79M59 90L72 82"
            stroke={sandSoft}
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.7}
          />
          <Path
            d="M97 114V83Q97 75 108 75Q119 75 119 83V114Z"
            fill={deepBlue}
          />
          <Circle cx={114} cy={97} r={2} fill={gold} />
          <Path
            d="M35 104Q22 93 26 81Q39 84 40 97Q41 82 50 77Q57 88 42 103"
            fill={olive}
          />
          <Path d="M29 102H46L43 115H32Z" fill={blue} />
          <Circle cx={138} cy={31} r={14} fill={deepBlue} />
          <Circle cx={138} cy={31} r={11} fill={colors.surface} />
          <Path
            d="M133 31.5L136.5 35L143.5 27.5"
            stroke={olive}
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M27 37L29 31M20 43L26 42"
            stroke={gold}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </Svg>
      ) : variant === 'step2' ? (
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 180 130"
          accessible={false}
        >
          <Defs>
            <LinearGradient id={backdropId} x1="0" y1="0" x2="1" y2="1">
              <Stop
                offset="0"
                stopColor={dark ? '#284C63' : '#D2E6F5'}
                stopOpacity={0.95}
              />
              <Stop
                offset="1"
                stopColor={dark ? '#1C3647' : '#EFE7DA'}
                stopOpacity={0.85}
              />
            </LinearGradient>
          </Defs>
          <Ellipse
            cx={90}
            cy={66}
            rx={68}
            ry={52}
            fill={`url(#${backdropId})`}
          />
          <G fill={sand} opacity={0.8}>
            <Rect x={28} y={62} width={28} height={36} rx={4} />
            <Rect x={122} y={56} width={30} height={42} rx={4} />
          </G>
          <G fill={deepBlue} opacity={0.75}>
            <Rect x={34} y={71} width={7} height={9} rx={1.5} />
            <Rect x={44} y={71} width={7} height={9} rx={1.5} />
            <Rect x={129} y={66} width={7} height={9} rx={1.5} />
            <Rect x={140} y={66} width={7} height={9} rx={1.5} />
          </G>
          <Path
            d="M22 103Q66 86 92 98T158 95"
            stroke={deepBlue}
            strokeWidth={12}
            strokeLinecap="round"
            fill="none"
            opacity={0.22}
          />
          <Path
            d="M22 103Q66 86 92 98T158 95"
            stroke={colors.surface}
            strokeWidth={2}
            strokeDasharray="6 6"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M115 44C115 58 94 79 90 84C86 79 65 58 65 44C65 30 76 19 90 19C104 19 115 30 115 44Z"
            fill={deepBlue}
            stroke={colors.surface}
            strokeWidth={2.5}
          />
          <Circle cx={90} cy={44} r={12} fill={colors.surface} />
          <Circle cx={90} cy={44} r={5.5} fill={gold} />
          <Path
            d="M123 30Q131 37 125 46M130 24Q141 36 132 51"
            stroke={blue}
            strokeWidth={2.6}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={44} cy={36} r={13} fill={olive} />
          <Path
            d="M40 31.5C40.5 31 41.8 31 42.3 31.7L43.5 33.4C43.9 33.9 43.8 34.6 43.3 35L42.5 35.6C43.2 37 44.3 38.1 45.7 38.8L46.3 38C46.7 37.5 47.4 37.4 47.9 37.8L49.6 39C50.3 39.5 50.3 40.8 49.8 41.3C48.7 42.4 46.8 42.7 44.3 41.2C41.4 39.5 39.1 37.2 38.8 34.4C38.6 33.1 39.1 32.3 40 31.5Z"
            fill="#FFFFFF"
          />
          <Path d="M142 98Q136 86 144 79Q152 84 147 98" fill={oliveLight} />
        </Svg>
      ) : variant === 'photo' ? (
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 220 120"
          accessible={false}
        >
          <Defs>
            <LinearGradient id={backdropId} x1="0" y1="0" x2="1" y2="1">
              <Stop
                offset="0"
                stopColor={dark ? '#203C4F' : '#DCECF8'}
                stopOpacity={0.95}
              />
              <Stop
                offset="1"
                stopColor={dark ? '#172936' : '#F4ECE0'}
                stopOpacity={0.95}
              />
            </LinearGradient>
          </Defs>
          <Rect
            x={22}
            y={10}
            width={176}
            height={100}
            rx={18}
            fill={`url(#${backdropId})`}
          />
          <Circle cx={166} cy={31} r={10} fill={gold} opacity={0.9} />
          <Path
            d="M36 96Q110 88 184 96"
            stroke={colors.border}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
          <Rect
            x={64}
            y={40}
            width={92}
            height={54}
            rx={5}
            fill={sand}
            stroke={deepBlue}
            strokeWidth={1.4}
          />
          <Path d="M58 51H162L152 34H68Z" fill={deepBlue} />
          <Path
            d="M75 34L70 51H84L87 34M99 34L97 51H111V34M123 34L125 51H139L134 34"
            fill={sandSoft}
          />
          <Rect x={76} y={60} width={34} height={22} rx={3} fill={deepBlue} />
          <Rect x={120} y={60} width={22} height={34} rx={3} fill={deepBlue} />
          <Circle
            cx={50}
            cy={86}
            r={10}
            fill={olive}
            stroke={oliveLight}
            strokeWidth={2}
          />
          <Path
            d="M26 27V18Q26 14 30 14H39M181 14H190Q194 14 194 18V27M26 93V102Q26 106 30 106H39M181 106H190Q194 106 194 102V93"
            stroke={blue}
            strokeWidth={3.5}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={172} cy={83} r={14} fill={deepBlue} />
          <Rect
            x={164}
            y={78}
            width={16}
            height={11}
            rx={3}
            fill={colors.surface}
          />
          <Circle cx={172} cy={83.5} r={3.2} fill={deepBlue} />
        </Svg>
      ) : (
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 180 130"
          accessible={false}
        >
          <Defs>
            <LinearGradient id={backdropId} x1="0" y1="0" x2="1" y2="1">
              <Stop
                offset="0"
                stopColor={dark ? '#234A59' : '#D5ECE5'}
                stopOpacity={0.95}
              />
              <Stop
                offset="1"
                stopColor={dark ? '#1F3A4D' : '#E2EFF8'}
                stopOpacity={0.9}
              />
            </LinearGradient>
          </Defs>
          <Circle cx={88} cy={66} r={54} fill={`url(#${backdropId})`} />
          <Rect
            x={44}
            y={28}
            width={88}
            height={80}
            rx={14}
            fill={sand}
            opacity={0.45}
            transform="rotate(-5 88 68)"
          />
          <Rect
            x={42}
            y={24}
            width={92}
            height={82}
            rx={14}
            fill={colors.surface}
            stroke={colors.border}
            strokeWidth={1.6}
          />
          <Rect x={52} y={34} width={72} height={16} rx={6} fill={sandSoft} />
          <Circle cx={63} cy={63} r={8} fill={blue} opacity={0.85} />
          <Rect
            x={77}
            y={58}
            width={42}
            height={4}
            rx={2}
            fill={colors.primaryDark}
            opacity={0.8}
          />
          <Rect
            x={77}
            y={66}
            width={28}
            height={3.5}
            rx={1.75}
            fill={colors.muted}
            opacity={0.55}
          />
          <Rect
            x={54}
            y={80}
            width={68}
            height={14}
            rx={7}
            fill={colors.surfaceContainer}
          />
          <Circle cx={132} cy={92} r={19} fill={colors.success} />
          <Circle
            cx={132}
            cy={92}
            r={19}
            fill="none"
            stroke={colors.surface}
            strokeWidth={3}
          />
          <Path
            d="M124 92.5L129.5 98L140.5 86.5"
            stroke={colors.onPrimary}
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M31 32L27 25M24 39L18 37M148 25L153 18"
            stroke={gold}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bannerDefault: {
    width: 112,
    height: 88,
    flexShrink: 0,
  },
  photoDefault: {
    width: 196,
    height: 106,
    alignSelf: 'center',
  },
  photoCompact: {
    width: 84,
    height: 50,
    flexShrink: 0,
  },
});
