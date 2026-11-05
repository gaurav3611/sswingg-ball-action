import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';
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

type Side3 = 'left' | 'right' | 'centre';
const boneSide = (a: string, b: string): Side3 => {
  const sa = sideOf(a as (typeof KEYPOINT_NAMES)[number]);
  const sb = sideOf(b as (typeof KEYPOINT_NAMES)[number]);
  return sa === sb ? sa : 'centre';
};

/**
 * The drawing of one person as a few path strings, grouped by side.
 *
 * A skeleton used to be drawn as a separate line or circle for every bone and joint, about 35
 * elements a person, redrawn ten times a second. Each one is a view to create and update on
 * the phone's UI thread, which is slow enough to make a phone stop responding. Joining them
 * into one path per side keeps the picture the same with 6 or 7 elements.
 */
export function skeletonPaths(
  keypoints: Keypoint[],
  rect: { x: number; y: number; width: number; height: number },
  radius: number,
): { bones: Record<Side3, string>; joints: Record<Side3, string> } {
  const bones: Record<Side3, string> = { left: '', right: '', centre: '' };
  const joints: Record<Side3, string> = { left: '', right: '', centre: '' };
  const at = (k: Keypoint) => ({ x: rect.x + k.x * rect.width, y: rect.y + k.y * rect.height });
  const f = (n: number) => n.toFixed(1);
  for (const [a, c] of SKELETON_EDGES) {
    const ka = keypoints[KP[a]]!;
    const kc = keypoints[KP[c]]!;
    if (ka.score < DRAW_MIN_SCORE || kc.score < DRAW_MIN_SCORE) continue;
    const pa = at(ka);
    const pc = at(kc);
    bones[boneSide(a, c)] += `M${f(pa.x)} ${f(pa.y)}L${f(pc.x)} ${f(pc.y)}`;
  }
  keypoints.forEach((k, i) => {
    if (k.score < DRAW_MIN_SCORE) return;
    const p = at(k);
    const side = sideOf(KEYPOINT_NAMES[i]!);
    // a circle as two half circle arcs
    joints[side] += `M${f(p.x - radius)} ${f(p.y)}a${radius} ${radius} 0 1 0 ${f(radius * 2)} 0a${radius} ${radius} 0 1 0 ${f(-radius * 2)} 0`;
  });
  return { bones, joints };
}

/** Most people drawn at once. The recording keeps three as well. */
const MAX_DRAWN = 3;

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
  // The bowler first, then the largest others.
  const drawn = [...people]
    .sort((a, b) => (a.trackId === bowlerId ? -1 : b.trackId === bowlerId ? 1 : b.box.w * b.box.h - a.box.w * a.box.h))
    .slice(0, MAX_DRAWN);
  const sides: Side3[] = ['left', 'right', 'centre'];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        {drawn.map((p) => {
          const isBowler = p.trackId === bowlerId;
          const w = isBowler ? 3 : 1.5;
          const { bones, joints } = skeletonPaths(p.keypoints, rect, isBowler ? 4.5 : 3);
          const allBones = sides.map((s) => bones[s]).join('');
          const allJoints = sides.map((s) => joints[s]).join('');
          return (
            <G key={p.trackId} opacity={isBowler ? 1 : 0.6}>
              {isBowler ? (
                <Rect
                  x={rect.x + p.box.x * rect.width}
                  y={rect.y + p.box.y * rect.height}
                  width={p.box.w * rect.width}
                  height={p.box.h * rect.height}
                  stroke={overlay.bowler}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  fill="none"
                />
              ) : null}
              {allBones ? <Path d={allBones} stroke={overlay.halo} strokeWidth={w + 3} strokeLinecap="round" fill="none" /> : null}
              {sides.map((s) => (bones[s] ? <Path key={`b${s}`} d={bones[s]} stroke={overlay[s]} strokeWidth={w} strokeLinecap="round" fill="none" /> : null))}
              {allJoints ? <Path d={allJoints} stroke={overlay.halo} strokeWidth={1.5} fill="none" /> : null}
              {sides.map((s) => (joints[s] ? <Path key={`j${s}`} d={joints[s]} fill={overlay[s]} stroke="none" /> : null))}
            </G>
          );
        })}
      </Svg>
      {drawn.map((p) => {
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
