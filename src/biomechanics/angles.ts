import { estimated, unavailable, type Measurement } from '@/core/measurement';
import { KP, joint, type KeypointName } from '@/pose/landmarks';
import type { CameraView, Keypoint, Side } from '@/pose/types';

/**
 * Joint angles from one 2D view. Read docs/METRICS.md before using any of these.
 *
 * Coordinate system: the upright camera frame, x to the right, y down. Angles are taken in
 * PIXELS, not in the 0 to 1 coordinates of the pose model, because those stretch width and
 * height by different amounts and would bend every angle. `frame` is the upright frame size.
 *
 * Every value is an estimate of the angle as PROJECTED onto the image. A single camera cannot
 * see depth, so a joint that bends towards or away from the lens looks straighter than it is.
 */
export type MetricId =
  | 'elbow_bowling'
  | 'elbow_other'
  | 'shoulder_elevation_bowling'
  | 'knee_left'
  | 'knee_right'
  | 'trunk_tilt'
  | 'shoulder_line_tilt'
  | 'hip_line_tilt';

export interface MetricInfo {
  id: MetricId;
  label: string;
  unit: string;
  /** What the number means, in one sentence. */
  meaning: string;
  /** The camera views in which it can be read. */
  views: CameraView[];
}

export const METRIC_INFO: Record<MetricId, MetricInfo> = {
  elbow_bowling: {
    id: 'elbow_bowling',
    label: 'Bowling elbow',
    unit: 'deg',
    meaning: 'Angle at the elbow between upper arm and forearm. 180 is a straight arm, small is a folded arm.',
    views: ['side', 'front', 'rear'],
  },
  elbow_other: {
    id: 'elbow_other',
    label: 'Other elbow',
    unit: 'deg',
    meaning: 'The same angle for the non-bowling arm.',
    views: ['side', 'front', 'rear'],
  },
  shoulder_elevation_bowling: {
    id: 'shoulder_elevation_bowling',
    label: 'Bowling arm elevation',
    unit: 'deg',
    meaning: 'Angle between the upper arm and the trunk. 0 is an arm hanging by the side, 90 is level with the shoulder, 180 is overhead.',
    views: ['side', 'front', 'rear'],
  },
  knee_left: {
    id: 'knee_left',
    label: 'Left knee',
    unit: 'deg',
    meaning: 'Angle at the knee between thigh and shin. 180 is a straight leg.',
    views: ['side', 'front', 'rear'],
  },
  knee_right: {
    id: 'knee_right',
    label: 'Right knee',
    unit: 'deg',
    meaning: 'The same angle for the right leg.',
    views: ['side', 'front', 'rear'],
  },
  trunk_tilt: {
    id: 'trunk_tilt',
    label: 'Trunk tilt',
    unit: 'deg',
    meaning:
      'Lean of the line from mid hip to mid shoulder away from vertical, in the image. Positive leans to the right of the image. From the side it is forward or back lean, from front or rear it is lateral lean.',
    views: ['side', 'front', 'rear'],
  },
  shoulder_line_tilt: {
    id: 'shoulder_line_tilt',
    label: 'Shoulder line tilt',
    unit: 'deg',
    meaning: 'Tilt of the line through both shoulders from horizontal, in the image. Positive means the right of the image is lower.',
    views: ['front', 'rear'],
  },
  hip_line_tilt: {
    id: 'hip_line_tilt',
    label: 'Hip line tilt',
    unit: 'deg',
    meaning: 'Tilt of the line through both hips from horizontal, in the image. Positive means the right of the image is lower.',
    views: ['front', 'rear'],
  },
};

export const METRIC_IDS = Object.keys(METRIC_INFO) as MetricId[];

/** A joint is used only if the model is at least this sure of it. */
export const MIN_JOINT_SCORE = 0.3;

const RAD = 180 / Math.PI;

interface Pt {
  x: number;
  y: number;
}

/** Interior angle at b between the rays b to a and b to c, in degrees from 0 to 180. */
export function angleAt(a: Pt, b: Pt, c: Pt): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const n1 = Math.hypot(v1x, v1y);
  const n2 = Math.hypot(v2x, v2y);
  if (n1 === 0 || n2 === 0) return NaN;
  const cos = (v1x * v2x + v1y * v2y) / (n1 * n2);
  return Math.acos(Math.max(-1, Math.min(1, cos))) * RAD;
}

/** Tilt of the line from p to q away from horizontal: -90 to 90, positive when q is lower than p. */
export function lineTilt(p: Pt, q: Pt): number {
  let deg = Math.atan2(q.y - p.y, q.x - p.x) * RAD;
  if (deg > 90) deg -= 180;
  if (deg < -90) deg += 180;
  return deg;
}

/** Lean of the line from `lower` to `upper` away from straight up: positive leans to the right. */
export function leanFromVertical(lower: Pt, upper: Pt): number {
  return Math.atan2(upper.x - lower.x, lower.y - upper.y) * RAD;
}

export interface AngleOptions {
  /** Size in pixels of the upright frame the keypoints belong to. */
  frame: { width: number; height: number };
  view: CameraView;
  bowlingArm: Side;
}

type Needs = { names: KeypointName[]; kps: Keypoint[] };

/** The weakest of the named points, or the first one below the threshold, with its name. */
function weakest({ names, kps }: Needs): { score: number; worst: KeypointName } {
  let worst = names[0]!;
  let score = kps[KP[worst]]!.score;
  for (const n of names) {
    const s = kps[KP[n]]!.score;
    if (s < score) {
      score = s;
      worst = n;
    }
  }
  return { score, worst };
}

const pretty = (n: KeypointName) => n.replace('_', ' ');

/** All pose metrics for one person in one frame. Each is a Measurement, never a bare number. */
export function computeAngles(kps: Keypoint[], opts: AngleOptions): Record<MetricId, Measurement> {
  const px = (n: KeypointName): Pt => {
    const k = kps[KP[n]]!;
    return { x: k.x * opts.frame.width, y: k.y * opts.frame.height };
  };
  const mid = (a: KeypointName, b: KeypointName): Pt => {
    const p = px(a);
    const q = px(b);
    return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  };

  const other: Side = opts.bowlingArm === 'left' ? 'right' : 'left';

  /** Runs `calc` if every point is visible enough, else explains what is missing. */
  const metric = (id: MetricId, names: KeypointName[], calc: () => number, note?: string): Measurement => {
    const info = METRIC_INFO[id];
    if (!info.views.includes(opts.view)) {
      return unavailable(info.unit, `Not readable from a ${opts.view} view. Use the ${info.views.join(' or ')} view.`);
    }
    const { score, worst } = weakest({ names, kps });
    if (score < MIN_JOINT_SCORE) {
      return unavailable(info.unit, `The ${pretty(worst)} is not visible enough (confidence ${score.toFixed(2)}).`);
    }
    const value = calc();
    if (!Number.isFinite(value)) return unavailable(info.unit, 'The points overlap, so no angle can be drawn.');
    return estimated(value, info.unit, score, note ?? 'Projected onto the image from one camera view.');
  };

  const bs = joint(opts.bowlingArm, 'shoulder');
  const be = joint(opts.bowlingArm, 'elbow');
  const bw = joint(opts.bowlingArm, 'wrist');
  const bh = joint(opts.bowlingArm, 'hip');
  const os = joint(other, 'shoulder');
  const oe = joint(other, 'elbow');
  const ow = joint(other, 'wrist');

  return {
    elbow_bowling: metric('elbow_bowling', [bs, be, bw], () => angleAt(px(bs), px(be), px(bw))),
    elbow_other: metric('elbow_other', [os, oe, ow], () => angleAt(px(os), px(oe), px(ow))),
    shoulder_elevation_bowling: metric('shoulder_elevation_bowling', [bs, be, bh], () =>
      angleAt(px(be), px(bs), px(bh)),
    ),
    knee_left: metric('knee_left', ['left_hip', 'left_knee', 'left_ankle'], () =>
      angleAt(px('left_hip'), px('left_knee'), px('left_ankle')),
    ),
    knee_right: metric('knee_right', ['right_hip', 'right_knee', 'right_ankle'], () =>
      angleAt(px('right_hip'), px('right_knee'), px('right_ankle')),
    ),
    trunk_tilt: metric(
      'trunk_tilt',
      ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'],
      () => leanFromVertical(mid('left_hip', 'right_hip'), mid('left_shoulder', 'right_shoulder')),
      'Image-plane lean from one view. Which way is forward depends on the bowler direction.',
    ),
    shoulder_line_tilt: metric('shoulder_line_tilt', ['left_shoulder', 'right_shoulder'], () =>
      lineTilt(px('left_shoulder'), px('right_shoulder')),
    ),
    hip_line_tilt: metric('hip_line_tilt', ['left_hip', 'right_hip'], () => lineTilt(px('left_hip'), px('right_hip'))),
  };
}
