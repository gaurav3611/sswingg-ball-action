import type { TrackingState } from '@/pose/status';

/**
 * The one word that says what the camera and the pose model are doing, for the diagnostics
 * panel. Worked out from facts only, so it can be tested.
 */
export type DiagnosticState = 'INITIALIZING' | 'READY' | 'TRACKING' | 'NO_PERSON_DETECTED' | 'MODEL_ERROR' | 'CAMERA_ERROR';

export function diagnosticState(f: {
  cameraError: boolean;
  cameraReady: boolean;
  model: 'loading' | 'ready' | 'error';
  /** The orientation check has finished. */
  orientationReady: boolean;
  /** How many analysed frames have come back from the model. */
  analysedFrames: number;
  peopleInView: number;
  tracking: TrackingState;
}): DiagnosticState {
  if (f.cameraError) return 'CAMERA_ERROR';
  if (f.model === 'error') return 'MODEL_ERROR';
  if (!f.cameraReady || f.model === 'loading') return 'INITIALIZING';
  if (!f.orientationReady) return f.peopleInView > 0 ? 'INITIALIZING' : 'NO_PERSON_DETECTED';
  if (f.analysedFrames === 0) return 'READY';
  if (f.peopleInView === 0) return 'NO_PERSON_DETECTED';
  return f.tracking === 'tracking' || f.tracking === 'low-confidence' ? 'TRACKING' : 'READY';
}

/** A running average that gives the latest values the most weight. */
export function ema(previous: number | null, next: number, weight = 0.2): number {
  return previous === null ? next : previous + weight * (next - previous);
}

/** Mean score of the points the model is at least `min` sure of, and how many of them there are. */
export function landmarkSummary(scores: number[], min = 0.3): { count: number; meanScore: number | null } {
  const used = scores.filter((s) => s >= min);
  return { count: used.length, meanScore: used.length === 0 ? null : used.reduce((a, b) => a + b, 0) / used.length };
}
