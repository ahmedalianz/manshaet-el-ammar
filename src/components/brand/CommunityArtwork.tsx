import { useId } from 'react';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Path,
  Rect,
  G,
} from 'react-native-svg';

// Decorative artwork only: all labels and controls remain native, scalable text.
export function CommunityArtwork({
  shop = false,
  dark = false,
}: {
  shop?: boolean;
  dark?: boolean;
}) {
  const id = useId();
  const skyId = `${id}-sky`;
  const landId = `${id}-land`;
  const blue = dark ? '#6FC5D0' : '#5489A7';
  const sand = dark ? '#B69B72' : '#D9B98F';
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={shop ? '0 0 180 160' : '0 0 420 130'}
      preserveAspectRatio="xMinYMax meet"
      accessible={false}
    >
      <Defs>
        <LinearGradient id={skyId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={dark ? '#163D47' : '#E1F1FC'} />
          <Stop offset="55%" stopColor={dark ? '#1B414A' : '#F8F3EA'} />
          <Stop offset="1" stopColor={dark ? '#122E38' : '#E6F2FA'} />
        </LinearGradient>
        <LinearGradient id={landId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={blue} stopOpacity=".65" />
          <Stop offset="1" stopColor={blue} stopOpacity=".15" />
        </LinearGradient>
      </Defs>
      {shop ? (
        <>
          <Rect x="26" y="43" width="112" height="109" rx="3" fill={sand} />
          <Path d="M18 61H148L132 30H36Z" fill={blue} />
          <Path
            d="M36 30L27 61H44L50 30M65 30L62 61H79V30M94 30L97 61H114L108 30M123 30L132 61H148L132 30"
            fill="#D8EAF3"
          />
          <Path
            d="M18 61Q27 75 36 61Q45 75 54 61Q63 75 72 61Q81 75 90 61Q99 75 108 61Q117 75 126 61Q137 75 148 61"
            fill={blue}
          />
          <Rect x="43" y="80" width="40" height="54" rx="2" fill="#28577A" />
          <Rect x="94" y="80" width="27" height="72" rx="2" fill="#28577A" />
          <Path
            d="M63 80V134M43 108H83M108 80V152"
            stroke="#A8C9DC"
            strokeWidth="3"
          />
          <Path
            d="M9 151H159M149 143V96M149 122Q126 108 132 98Q153 101 149 122M150 112Q170 92 174 106Q170 122 150 125M149 139Q124 132 128 119Q145 121 149 139"
            stroke="#738A68"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          <Path d="M138 141H160L157 157H142Z" fill={sand} />
        </>
      ) : (
        <>
          <Rect width="420" height="130" fill={`url(#${skyId})`} />
          <Path
            d="M0 98Q69 70 129 87T253 94T420 108V130H0Z"
            fill={sand}
            opacity=".35"
          />
          <G fill={sand}>
            <Path d="M0 97V75H21V92H30V67H53V105M59 102V81H80V72H101V104M119 105V84H141V65H163V102" />
          </G>
          <G fill={blue}>
            <Path d="M8 97V85H14V97M36 81H42V89H36ZM46 73H50V82H46ZM67 88H72V95H67ZM86 80H92V88H86ZM127 90H133V98H127ZM149 72H155V83H149Z" />
            <Path d="M105 101V39H113V101M103 40H115V45H103M107 38V27L109 22L111 27V38M102 62H116V66H102" />
            <Path d="M73 98L76 66H79L82 98M78 66Q58 53 54 65Q66 60 77 69Q67 70 64 78Q72 72 78 70Q92 65 98 72Q96 59 81 65Q85 50 92 53Q82 48 78 63Q74 49 66 53Q74 53 78 66" />
          </G>
          <Path
            d="M0 108Q60 132 137 111T275 114T420 112V130H0Z"
            fill={`url(#${landId})`}
          />
          <Path
            d="M0 113Q64 137 145 116T283 120T420 118"
            stroke={dark ? '#6FC5D0' : '#7CAEC1'}
            strokeWidth="1.8"
            fill="none"
          />
        </>
      )}
    </Svg>
  );
}
