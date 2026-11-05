import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Polyline, Rect } from 'react-native-svg';
import { Txt } from './ui';
import { runs, type SeriesPoint } from '@/biomechanics/series';
import { colors } from '@/theme/tokens';

const PAD = { left: 34, right: 8, top: 8, bottom: 20 };

/**
 * One angle over the recording, with a marker at the current moment.
 * The scale is fixed at 0 to 180 degrees so charts of different sessions can be compared.
 * Where there is no reading the line is broken, never joined across the gap.
 */
export function AngleChart({
  points,
  currentMs,
  durationMs,
  label,
}: {
  points: SeriesPoint[];
  currentMs: number;
  durationMs: number;
  label: string;
}) {
  const [w, setW] = useState(0);
  const H = 140;
  const innerW = Math.max(1, w - PAD.left - PAD.right);
  const innerH = H - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + (Math.min(Math.max(t, 0), durationMs) / Math.max(1, durationMs)) * innerW;
  const y = (deg: number) => PAD.top + (1 - Math.min(Math.max(deg, 0), 180) / 180) * innerH;

  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} accessible accessibilityLabel={`${label} over the recording, 0 to 180 degrees`}>
      {w > 0 ? (
        <Svg width={w} height={H}>
          <Rect x={PAD.left} y={PAD.top} width={innerW} height={innerH} fill={colors.surface2} />
          {[0, 90, 180].map((deg) => (
            <Line key={deg} x1={PAD.left} x2={PAD.left + innerW} y1={y(deg)} y2={y(deg)} stroke={colors.line} strokeWidth={1} />
          ))}
          {runs(points).map((r, i) =>
            r.length === 1 ? (
              <Rect key={i} x={x(r[0]!.t) - 1.5} y={y(r[0]!.value!) - 1.5} width={3} height={3} fill={colors.ochre} />
            ) : (
              <Polyline key={i} points={r.map((p) => `${x(p.t)},${y(p.value!)}`).join(' ')} fill="none" stroke={colors.ochre} strokeWidth={2} strokeLinejoin="round" />
            ),
          )}
          <Line x1={x(currentMs)} x2={x(currentMs)} y1={PAD.top} y2={PAD.top + innerH} stroke={colors.text} strokeWidth={1.5} />
        </Svg>
      ) : null}
      <View style={{ position: 'absolute', left: 0, top: PAD.top - 6, height: innerH + 12, justifyContent: 'space-between' }} pointerEvents="none">
        {[180, 90, 0].map((d) => (
          <Txt key={d} variant="small" tone="muted" style={{ fontSize: 11, lineHeight: 12, width: PAD.left - 6, textAlign: 'right' }}>
            {d}
          </Txt>
        ))}
      </View>
    </View>
  );
}
