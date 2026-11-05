import type { PoseTrack } from '@/data/poseFile';
import type { CameraView, Side } from '@/pose/types';
import { computeAngles, type MetricId } from './angles';

export interface SeriesPoint {
  /** Pose frame time in ms. */
  t: number;
  /** The angle, or null when it could not be read in this frame. */
  value: number | null;
}

/**
 * One metric for the bowler across a recording. A frame in which the bowler was not followed,
 * or in which the joints were not visible enough, gives null: the chart leaves a gap there
 * instead of joining the line across it.
 */
export function angleSeries(track: PoseTrack, metric: MetricId, view: CameraView, bowlingArm: Side): SeriesPoint[] {
  const frame = { width: track.width, height: track.height };
  return track.frames.map((f) => {
    const bowler = f.bowlerId === null ? undefined : f.people.find((p) => p.trackId === f.bowlerId);
    if (!bowler) return { t: f.t, value: null };
    return { t: f.t, value: computeAngles(bowler.keypoints, { frame, view, bowlingArm })[metric].value };
  });
}

/** Splits a series into runs of consecutive readings, so a gap is not drawn as a line. */
export function runs(points: SeriesPoint[], maxGapMs = 400): SeriesPoint[][] {
  const out: SeriesPoint[][] = [];
  let current: SeriesPoint[] = [];
  for (const p of points) {
    const last = current[current.length - 1];
    if (p.value === null || (last && p.t - last.t > maxGapMs)) {
      if (current.length) out.push(current);
      current = [];
      if (p.value === null) continue;
    }
    current.push(p);
  }
  if (current.length) out.push(current);
  return out;
}

/** How much of the recording has a reading, 0 to 1. Shown beside every chart. */
export function coverage(points: SeriesPoint[]): number {
  return points.length === 0 ? 0 : points.filter((p) => p.value !== null).length / points.length;
}
