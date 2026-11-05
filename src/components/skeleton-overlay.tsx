import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Rect } from 'react-native-svg';
import { Txt } from './ui';
import { KEYPOINT_NAMES, SKELETON_EDGES, KP, sideOf } from '@/pose/landmarks';
import type { Keypoint, TrackedPerson } from '@/pose/types';
import { overlay } from '@/theme/tokens';

/** A joint under this score is not drawn. A guess is not shown as if it were a measurement. */
export const DRAW_MIN_SCORE = 0.3;

export interface FitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const tint = (a: string, b: string) => {
  const sa = sideOf(a as (typeof KEYPOINT_NAMES)[number]);
  const sb = sideOf(b as (typeof KEYPOINT_NAMES)[number]);
  return sa === sb ? overlay[sa === 'left' ? 'left' : sa === 'right' ? 'right' : 'centre'] : overlay.centre;
};

/** The number of joints of a person that are drawn. */
export const visibleJoints = (kps: Keypoint[]) => kps.filter((k) => k.score >= DRAW_MIN_SCORE).length;

/**
 * Skeletons of the people in view, drawn over the picture.
 * `rect` is where the picture sits inside the view, so a letterboxed picture lines up.
 * When `onSelect` is given, each person who is not the bowler can be tapped to follow them.
 */
export function SkeletonOverlay({
  people,
  bowlerId,
  rect,
  onSelect,
  showLabels = false,
}: {
  people: TrackedPerson[];
  bowlerId: number | null;
  rect: FitRect;
  onSelect?: (trackId: number) => void;
  showLabels?: boolean;
}) {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const px = (k: Keypoint) => ({ x: rect.x + k.x * rect.width, y: rect.y + k.y * rect.height });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        {people.map((p) => {
          const isBowler = p.trackId === bowlerId;
          const w = isBowler ? 3 : 1.5;
          const b = { x: rect.x + p.box.x * rect.width, y: rect.y + p.box.y * rect.height, w: p.box.w * rect.width, h: p.box.h * rect.height };
          return (
            <G key={p.trackId}>
              {isBowler ? (
                <Rect x={b.x} y={b.y} width={b.w} height={b.h} stroke={overlay.bowler} strokeWidth={1.5} strokeDasharray="6 4" fill="none" />
              ) : null}
              {SKELETON_EDGES.map(([a, c]) => {
                const ka = p.keypoints[KP[a]]!;
                const kc = p.keypoints[KP[c]]!;
                if (ka.score < DRAW_MIN_SCORE || kc.score < DRAW_MIN_SCORE) return null;
                const pa = px(ka);
                const pc = px(kc);
                return (
                  <G key={`${a}-${c}`}>
                    <Line x1={pa.x} y1={pa.y} x2={pc.x} y2={pc.y} stroke={overlay.halo} strokeWidth={w + 3} strokeLinecap="round" />
                    <Line x1={pa.x} y1={pa.y} x2={pc.x} y2={pc.y} stroke={tint(a, c)} strokeWidth={w} strokeLinecap="round" opacity={isBowler ? 1 : 0.55} />
                  </G>
                );
              })}
              {p.keypoints.map((k, i) => {
                if (k.score < DRAW_MIN_SCORE) return null;
                const pt = px(k);
                const side = sideOf(KEYPOINT_NAMES[i]!);
                return (
                  <Circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r={isBowler ? 4.5 : 3}
                    fill={overlay[side === 'centre' ? 'centre' : side]}
                    stroke={overlay.halo}
                    strokeWidth={1.5}
                    opacity={isBowler ? 1 : 0.6}
                  />
                );
              })}
            </G>
          );
        })}
      </Svg>
      {people.map((p) => {
        const isBowler = p.trackId === bowlerId;
        const left = rect.x + p.box.x * rect.width;
        const top = rect.y + p.box.y * rect.height;
        const width = p.box.w * rect.width;
        const height = p.box.h * rect.height;
        return (
          <View key={p.trackId} style={{ position: 'absolute', left, top, width, height }} pointerEvents="box-none">
            {onSelect && !isBowler ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Follow person ${p.trackId} as the bowler`}
                onPress={() => onSelect(p.trackId)}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            {showLabels ? (
              <View style={{ position: 'absolute', left: 0, top: -22, backgroundColor: overlay.halo, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                <Txt variant="small" style={{ color: '#fff', fontSize: 12, lineHeight: 16 }}>
                  {isBowler ? `Bowler, ${visibleJoints(p.keypoints)} of 17 joints` : `Person ${p.trackId}, tap to follow`}
                </Txt>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
