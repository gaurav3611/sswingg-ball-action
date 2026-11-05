/** A body point. x and y run 0 to 1 across the upright frame, y downward. score is 0 to 1. */
export interface Keypoint {
  x: number;
  y: number;
  score: number;
}

/** A box around a person, in the same 0 to 1 coordinates. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One person found in one frame, before tracking. */
export interface Detection {
  box: Box;
  score: number;
  keypoints: Keypoint[];
}

/** A detection that has been given a stable id by the tracker. */
export interface TrackedPerson extends Detection {
  trackId: number;
}

/** Everything found in one analysed frame. t is milliseconds since the recording started. */
export interface PoseFrame {
  t: number;
  people: TrackedPerson[];
  /** The track that is the bowler, or null when none is chosen or it was not seen. */
  bowlerId: number | null;
}

export type Side = 'left' | 'right';
export type CameraView = 'side' | 'front' | 'rear';
