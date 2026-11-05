import type { Keypoint } from './types';

export type Rotation = 0 | 90 | 180 | 270;
export const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];

export interface Size {
  width: number;
  height: number;
}

/** Size of the frame after it has been turned upright by `rotation` degrees. */
export function uprightSize(frame: Size, rotation: Rotation): Size {
  return rotation === 90 || rotation === 270
    ? { width: frame.height, height: frame.width }
    : { width: frame.width, height: frame.height };
}

/** The largest rectangle of the given aspect ratio that fits in the container, centred. */
export function fitRect(container: Size, aspect: number): { x: number; y: number; width: number; height: number } {
  if (container.width <= 0 || container.height <= 0 || aspect <= 0) return { x: 0, y: 0, width: 0, height: 0 };
  const containerAspect = container.width / container.height;
  if (containerAspect > aspect) {
    const width = container.height * aspect;
    return { x: (container.width - width) / 2, y: 0, width, height: container.height };
  }
  const height = container.width / aspect;
  return { x: 0, y: (container.height - height) / 2, width: container.width, height };
}

/**
 * How upright is a pose? 1 when the head is above the hips and the hips above the knees,
 * counted over the points the model is sure about. Used to find which way the frame must be
 * turned: a person lying on their side scores low.
 */
export function uprightScore(kps: Keypoint[]): number {
  const mid = (a: number, b: number): Keypoint | null => {
    const p = kps[a]!;
    const q = kps[b]!;
    if (p.score < 0.2 || q.score < 0.2) return null;
    return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, score: Math.min(p.score, q.score) };
  };
  const nose = kps[0]!.score >= 0.2 ? kps[0]! : null;
  const shoulders = mid(5, 6);
  const hips = mid(11, 12);
  const knees = mid(13, 14);
  const ankles = mid(15, 16);
  const chain = [nose, shoulders, hips, knees, ankles].filter((p): p is Keypoint => p !== null);
  if (chain.length < 3) return 0;
  let ok = 0;
  for (let i = 1; i < chain.length; i++) if (chain[i]!.y > chain[i - 1]!.y) ok++;
  return ok / (chain.length - 1);
}

/**
 * Picks the rotation whose pose is the most convincing: it must find a person, and that
 * person must be upright. Returns null when no rotation found anyone.
 */
export function chooseRotation(
  trials: { rotation: Rotation; personScore: number; upright: number }[],
): { rotation: Rotation; confidence: number } | null {
  let best: { rotation: Rotation; value: number } | null = null;
  for (const t of trials) {
    const value = t.personScore * (0.25 + 0.75 * t.upright);
    if (t.personScore > 0 && (!best || value > best.value)) best = { rotation: t.rotation, value };
  }
  return best ? { rotation: best.rotation, confidence: Math.min(1, best.value) } : null;
}
