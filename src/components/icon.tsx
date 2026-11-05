import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { ICONS, type IconName } from './icon-data';
import { colors } from '@/theme/tokens';

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

/**
 * One line icon from the SSwinGG icon set (Lucide shapes, see tools/icons.mjs).
 * It is decoration: the words next to it say what it means, and a button that holds only an
 * icon needs an accessibilityLabel.
 */
export function Icon({ name, size = 20, color = colors.text, strokeWidth = 2 }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {ICONS[name].map((shape, i) => {
        if (shape.tag === 'path') return <Path key={i} d={shape.d} />;
        if (shape.tag === 'circle') return <Circle key={i} cx={shape.cx} cy={shape.cy} r={shape.r} />;
        return <Rect key={i} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} />;
      })}
    </Svg>
  );
}
