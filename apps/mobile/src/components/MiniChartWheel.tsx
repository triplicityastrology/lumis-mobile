import Svg, { Circle, G, Line, Path } from "react-native-svg";

import { colors } from "../theme/tokens";

export function MiniChartWheel({ size = 88 }: { size?: number }) {
  const center = 50;
  const spokes = Array.from({ length: 12 }, (_, index) => {
    const angle = (index * Math.PI) / 6 - Math.PI / 2;
    return {
      x: center + Math.cos(angle) * 42,
      y: center + Math.sin(angle) * 42
    };
  });

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Birth chart wheel">
      <Circle cx="50" cy="50" r="47" fill={colors.navy950} stroke={colors.gold} strokeWidth="1" />
      <Circle cx="50" cy="50" r="37" fill="none" stroke={colors.periwinkle} strokeOpacity="0.56" />
      <Circle cx="50" cy="50" r="23" fill="none" stroke={colors.gold} strokeOpacity="0.68" />
      <G>
        {spokes.map((point, index) => (
          <Line
            key={index}
            x1="50"
            y1="50"
            x2={point.x}
            y2={point.y}
            stroke={colors.ice}
            strokeOpacity="0.18"
            strokeWidth="0.8"
          />
        ))}
      </G>
      <Path d="M50 13 A37 37 0 0 1 82 69" fill="none" stroke={colors.goldLight} strokeWidth="2" />
      <Circle cx="50" cy="50" r="5" fill={colors.gold} />
      <Circle cx="79" cy="27" r="2.5" fill={colors.periwinkle} />
    </Svg>
  );
}
