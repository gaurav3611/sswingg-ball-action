import type { Box, Detection, Keypoint } from './types';

/** The model reads a 256 by 256 picture. */
export const MOVENET_INPUT_SIZE = 256;
/** It reports at most six people per frame. */
export const MOVENET_MAX_PEOPLE = 6;

const KEYPOINTS = 17;
/** Per person: 17 points of (y, x, score), then the box (ymin, xmin, ymax, xmax) and a person score. */
const STRIDE = KEYPOINTS * 3 + 5;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Turns the output tensor of MoveNet MultiPose Lightning, shape [1, 6, 56], into detections.
 *
 * Coordinates in the tensor are fractions of the picture the model was given. Because the
 * whole frame is stretched into that picture (not cropped), they are also fractions of the
 * frame, so no further mapping is needed once the frame has been rotated upright.
 * Slots with a person score under `minPersonScore` are empty and are skipped.
 */
export function decodeMultiPose(output: ArrayLike<number>, minPersonScore = 0.2): Detection[] {
  if (output.length !== MOVENET_MAX_PEOPLE * STRIDE) {
    throw new Error(`Pose output has ${output.length} values, expected ${MOVENET_MAX_PEOPLE * STRIDE}`);
  }
  const found: Detection[] = [];
  for (let p = 0; p < MOVENET_MAX_PEOPLE; p++) {
    const base = p * STRIDE;
    const score = output[base + 55]!;
    if (!(score >= minPersonScore)) continue;
    const keypoints: Keypoint[] = [];
    for (let k = 0; k < KEYPOINTS; k++) {
      keypoints.push({
        y: clamp01(output[base + k * 3]!),
        x: clamp01(output[base + k * 3 + 1]!),
        score: clamp01(output[base + k * 3 + 2]!),
      });
    }
    const ymin = clamp01(output[base + 51]!);
    const xmin = clamp01(output[base + 52]!);
    const ymax = clamp01(output[base + 53]!);
    const xmax = clamp01(output[base + 54]!);
    const box: Box = { x: xmin, y: ymin, w: Math.max(0, xmax - xmin), h: Math.max(0, ymax - ymin) };
    found.push({ box, score, keypoints });
  }
  return found;
}
