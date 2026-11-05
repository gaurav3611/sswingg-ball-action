import type { Side } from './types';

/**
 * The 17 body points MoveNet finds, in the order the model writes them.
 * The heels and foot points that the spec lists are not part of this model: a model that has
 * them (MediaPipe BlazePose has 33 points) can be added behind the same Keypoint type.
 */
export const KEYPOINT_NAMES = [
  'nose',
  'left_eye',
  'right_eye',
  'left_ear',
  'right_ear',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
] as const;

export type KeypointName = (typeof KEYPOINT_NAMES)[number];

export const KP = Object.fromEntries(KEYPOINT_NAMES.map((n, i) => [n, i])) as Record<KeypointName, number>;

/** Pairs of points that are joined by a line in the skeleton overlay. */
export const SKELETON_EDGES: readonly [KeypointName, KeypointName][] = [
  ['left_ear', 'left_eye'],
  ['left_eye', 'nose'],
  ['nose', 'right_eye'],
  ['right_eye', 'right_ear'],
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
];

export function sideOf(name: KeypointName): Side | 'centre' {
  if (name.startsWith('left_')) return 'left';
  if (name.startsWith('right_')) return 'right';
  return 'centre';
}

/** Name of a joint on one side, for example joint('right', 'elbow') is 'right_elbow'. */
export function joint(side: Side, part: 'shoulder' | 'elbow' | 'wrist' | 'hip' | 'knee' | 'ankle'): KeypointName {
  return `${side}_${part}` as KeypointName;
}

/** The joints used to decide whether the bowler is being followed well. */
export const CORE_JOINTS: readonly KeypointName[] = [
  'left_shoulder',
  'right_shoulder',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
];
