import type { Rotation } from '@/pose/geometry';
import type { PoseFrame, TrackedPerson } from '@/pose/types';

/**
 * The pose track of one recording, as saved next to the video.
 *
 * Numbers are rounded to 3 decimals, which is under a pixel on a 1080 line frame. A frame is
 * [t, bowlerId or -1, people], a person is [trackId, score, x, y, w, h, keypoints], and
 * keypoints are a flat list of x, y, score for each of the 17 points.
 */
export interface PoseTrack {
  version: 1;
  modelId: string;
  /** Upright frame size in pixels, for angles in pixel space. */
  width: number;
  height: number;
  rotation: Rotation;
  frames: PoseFrame[];
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function encodePoseTrack(track: PoseTrack): string {
  return JSON.stringify({
    version: track.version,
    modelId: track.modelId,
    width: track.width,
    height: track.height,
    rotation: track.rotation,
    frames: track.frames.map((f) => [
      Math.round(f.t),
      f.bowlerId ?? -1,
      f.people.map((p) => [
        p.trackId,
        r3(p.score),
        r3(p.box.x),
        r3(p.box.y),
        r3(p.box.w),
        r3(p.box.h),
        p.keypoints.flatMap((k) => [r3(k.x), r3(k.y), r3(k.score)]),
      ]),
    ]),
  });
}

/** Reads a saved track. Returns null if the text is not a pose track, instead of throwing. */
export function decodePoseTrack(text: string): PoseTrack | null {
  try {
    const raw = JSON.parse(text);
    if (raw?.version !== 1 || !Array.isArray(raw.frames)) return null;
    const frames: PoseFrame[] = raw.frames.map((f: [number, number, unknown[][]]) => ({
      t: f[0],
      bowlerId: f[1] === -1 ? null : f[1],
      people: f[2].map((p): TrackedPerson => {
        const [trackId, score, x, y, w, h, flat] = p as [number, number, number, number, number, number, number[]];
        const keypoints = [];
        for (let i = 0; i + 2 < flat.length; i += 3) keypoints.push({ x: flat[i]!, y: flat[i + 1]!, score: flat[i + 2]! });
        return { trackId, score, box: { x, y, w, h }, keypoints };
      }),
    }));
    return { version: 1, modelId: raw.modelId, width: raw.width, height: raw.height, rotation: raw.rotation, frames };
  } catch {
    return null;
  }
}

/** The frame closest in time to `tMs`, or null if the track is empty or `tMs` is far from any frame. */
export function frameAt(track: PoseTrack, tMs: number, maxGapMs = 400): PoseFrame | null {
  const frames = track.frames;
  if (frames.length === 0) return null;
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid]!.t < tMs) lo = mid + 1;
    else hi = mid;
  }
  const after = frames[lo]!;
  const before = lo > 0 ? frames[lo - 1]! : after;
  const nearest = Math.abs(before.t - tMs) <= Math.abs(after.t - tMs) ? before : after;
  return Math.abs(nearest.t - tMs) <= maxGapMs ? nearest : null;
}
