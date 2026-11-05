import { CORE_JOINTS, KP } from './landmarks';
import type { Box, TrackedPerson } from './types';

export type TrackingState = 'searching' | 'tracking' | 'low-confidence' | 'lost' | 'left-frame';

export interface TrackingStatus {
  state: TrackingState;
  /** A short sentence for the person holding the phone. */
  message: string;
}

/** Share of the frame, at each edge, that counts as "at the edge". */
const EDGE = 0.03;
/** How long (ms) the bowler can be unseen before we say so. */
export const LOST_AFTER_MS = 500;
export const LOW_CONFIDENCE_BELOW = 0.4;

export function touchesEdge(box: Box): boolean {
  return box.x <= EDGE || box.y <= EDGE || box.x + box.w >= 1 - EDGE || box.y + box.h >= 1 - EDGE;
}

/** The mean score of the six joints that the angle metrics rest on. */
export function coreConfidence(p: TrackedPerson): number {
  let sum = 0;
  for (const name of CORE_JOINTS) sum += p.keypoints[KP[name]]!.score;
  return sum / CORE_JOINTS.length;
}

/**
 * What to tell the user about tracking right now.
 *
 * @param lockedId the track chosen as the bowler, or null before one is chosen
 * @param people everyone seen in the latest analysed frame
 * @param msSinceBowlerSeen time since the bowler last appeared, null if never
 * @param lastBowlerBox where the bowler last was, to tell "left the frame" from "hidden"
 */
export function trackingStatus(args: {
  lockedId: number | null;
  people: TrackedPerson[];
  msSinceBowlerSeen: number | null;
  lastBowlerBox: Box | null;
}): TrackingStatus {
  const { lockedId, people, msSinceBowlerSeen, lastBowlerBox } = args;
  if (lockedId === null) {
    return people.length === 0
      ? { state: 'searching', message: 'No one in view. Step into the frame.' }
      : { state: 'searching', message: 'Tap the bowler to follow them.' };
  }
  const bowler = people.find((p) => p.trackId === lockedId);
  if (bowler) {
    return coreConfidence(bowler) >= LOW_CONFIDENCE_BELOW
      ? { state: 'tracking', message: 'Following the bowler.' }
      : { state: 'low-confidence', message: 'Body only partly visible. Angles may be unreliable.' };
  }
  if (msSinceBowlerSeen !== null && msSinceBowlerSeen < LOST_AFTER_MS) {
    return { state: 'tracking', message: 'Following the bowler.' };
  }
  return lastBowlerBox && touchesEdge(lastBowlerBox)
    ? { state: 'left-frame', message: 'The bowler left the frame.' }
    : { state: 'lost', message: 'Lost the bowler. Tracking resumes if they reappear.' };
}
