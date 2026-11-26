import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { useAppTheme } from '../../theme/ThemeProvider';

// Decorative search illustration; the accompanying native text carries meaning.
export function SearchEmptyArtwork() {
  const { colors } = useAppTheme();
  return (
    <Svg width={220} height={150} viewBox="0 0 220 150" accessible={false}>
      <Ellipse
        cx={111}
        cy={78}
        rx={87}
        ry={61}
        fill={colors.surfaceContainer}
      />
      <Circle cx={162} cy={90} r={43} fill={colors.secondary} />
      <Rect
        x={64}
        y={29}
        width={96}
        height={110}
        rx={12}
        fill={colors.border}
      />
      <Rect
        x={74}
        y={39}
        width={76}
        height={14}
        rx={5}
        fill={colors.accent}
        opacity={0.5}
      />
      {[69, 91, 113].map((y) => (
        <G key={y} fill={colors.accent} opacity={0.45}>
          <Circle cx={83} cy={y} r={6} />
          <Rect x={96} y={y - 4} width={39} height={3} rx={1.5} />
          <Rect x={96} y={y + 3} width={27} height={3} rx={1.5} />
        </G>
      ))}
      <Path
        d="M64 139C38 135 21 115 24 83C49 87 68 110 64 139Z"
        fill="#7CA58B"
      />
      <Path
        d="M62 139C39 142 22 134 13 120C34 113 51 121 62 139Z"
        fill="#91B59B"
      />
      <Path d="M62 137L31 94" stroke="#5D876F" strokeWidth={2} fill="none" />
      <Path
        d="M158 111L180 132"
        stroke={colors.primary}
        strokeWidth={12}
        strokeLinecap="round"
      />
      <Circle
        cx={143}
        cy={94}
        r={25}
        fill={colors.surfaceContainer}
        fillOpacity={0.9}
        stroke={colors.primary}
        strokeWidth={6}
      />
      <Path
        d="M129 91Q130 81 140 79"
        stroke={colors.surface}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M164 24L165 14M176 31L183 23M182 42L193 40"
        stroke="#F0B329"
        strokeWidth={5}
        strokeLinecap="round"
      />
    </Svg>
  );
}
