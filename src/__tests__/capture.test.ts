import { bestFormatFor, supportedFps, supportsFps, type FormatLike } from '@/capture/capabilities';
import { addFrame, emptyCounters, summariseTiming, type FrameCounters } from '@/capture/timing';
import { chooseRotation, fitRect, uprightScore, uprightSize } from '@/pose/geometry';
import { KEYPOINT_NAMES, type KeypointName } from '@/pose/landmarks';
import type { Keypoint } from '@/pose/types';

const f = (w: number, h: number, min: number, max: number): FormatLike => ({
  videoWidth: w,
  videoHeight: h,
  minFps: min,
  maxFps: max,
});

describe('supported frame rates', () => {
  const phone = [f(3840, 2160, 1, 60), f(1920, 1080, 1, 60), f(1280, 720, 1, 240), f(640, 480, 1, 240)];

  it('offers only rates that some usable format reaches', () => {
    expect(supportedFps(phone)).toEqual([30, 60, 120, 240]);
    expect(supportedFps([f(1920, 1080, 1, 60)])).toEqual([30, 60]);
    expect(supportedFps([f(1920, 1080, 1, 30)])).toEqual([30]);
  });

  it('does not offer a rate that only a tiny format reaches', () => {
    expect(supportedFps([f(1920, 1080, 1, 30), f(640, 480, 1, 240)])).toEqual([30]);
  });

  it('offers nothing when no format is usable', () => {
    expect(supportedFps([])).toEqual([]);
  });

  it('checks the range edges', () => {
    expect(supportsFps(f(1920, 1080, 30, 60), 30)).toBe(true);
    expect(supportsFps(f(1920, 1080, 30, 60), 60)).toBe(true);
    expect(supportsFps(f(1920, 1080, 30, 60), 24)).toBe(false);
    expect(supportsFps(f(1920, 1080, 30, 60), 120)).toBe(false);
  });

  it('picks the format closest to 1080 that can do the rate', () => {
    expect(bestFormatFor(phone, 30)).toEqual(f(1920, 1080, 1, 60));
    expect(bestFormatFor(phone, 120)).toEqual(f(1280, 720, 1, 240));
    expect(bestFormatFor(phone, 24 * 100)).toBeUndefined();
  });
});

function run(timestamps: number[]): FrameCounters {
  return timestamps.reduce((c, t) => addFrame(c, t), emptyCounters());
}
const every = (ms: number, n: number, start = 1000) => Array.from({ length: n }, (_, i) => start + i * ms);

describe('frame timing', () => {
  it('reads a clean 60 fps second', () => {
    const s = summariseTiming(run(every(1000 / 60, 61)), 60);
    expect(s.frames).toBe(61);
    expect(s.seconds).toBeCloseTo(1);
    expect(s.deliveredFps).toBeCloseTo(60);
    expect(s.droppedEstimate).toBe(0);
    expect(s.belowRequested).toBe(false);
  });

  it('counts missing frames and the longest gap', () => {
    const ts = every(1000 / 30, 31).filter((_, i) => i !== 10 && i !== 11); // two frames lost together
    const s = summariseTiming(run(ts), 30);
    expect(s.droppedEstimate).toBe(2);
    expect(s.longestGapMs).toBeCloseTo(100, 0);
  });

  it('says so when the phone delivered far less than was asked for', () => {
    const s = summariseTiming(run(every(1000 / 30, 31)), 120); // asked 120, got 30
    expect(s.deliveredFps).toBeCloseTo(30);
    expect(s.belowRequested).toBe(true);
    expect(s.droppedEstimate).toBeGreaterThan(80);
  });

  it('reads nanosecond timestamps as nanoseconds', () => {
    const ns = every(1000 / 60, 61, 5e12).map((t) => t * 1e6);
    expect(summariseTiming(run(ns), 60).deliveredFps).toBeCloseTo(60, 3);
  });

  it('gives no rate from fewer than two frames', () => {
    expect(summariseTiming(run([5]), 30).deliveredFps).toBeNull();
    expect(summariseTiming(emptyCounters(), 30).deliveredFps).toBeNull();
    expect(summariseTiming(emptyCounters(), 30).belowRequested).toBe(false);
  });
});

describe('geometry', () => {
  it('swaps width and height for a quarter turn', () => {
    const size = { width: 1920, height: 1080 };
    expect(uprightSize(size, 0)).toEqual(size);
    expect(uprightSize(size, 180)).toEqual(size);
    expect(uprightSize(size, 90)).toEqual({ width: 1080, height: 1920 });
    expect(uprightSize(size, 270)).toEqual({ width: 1080, height: 1920 });
  });

  it('fits a picture inside a screen without cropping it', () => {
    // a 16:9 picture on a tall phone is letterboxed top and bottom
    const r = fitRect({ width: 400, height: 800 }, 16 / 9);
    expect(r.width).toBe(400);
    expect(r.height).toBeCloseTo(225);
    expect(r.x).toBe(0);
    expect(r.y).toBeCloseTo(287.5);
    // a tall picture on a wide screen is pillarboxed
    const q = fitRect({ width: 800, height: 400 }, 9 / 16);
    expect(q.height).toBe(400);
    expect(q.width).toBeCloseTo(225);
    expect(q.x).toBeCloseTo(287.5);
    expect(fitRect({ width: 0, height: 0 }, 1.5)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  const body = (pts: Partial<Record<KeypointName, [number, number]>>): Keypoint[] =>
    KEYPOINT_NAMES.map((n) => (pts[n] ? { x: pts[n]![0], y: pts[n]![1], score: 0.9 } : { x: 0, y: 0, score: 0 }));

  const standing = body({
    nose: [0.5, 0.1], left_shoulder: [0.45, 0.25], right_shoulder: [0.55, 0.25],
    left_hip: [0.46, 0.5], right_hip: [0.54, 0.5], left_knee: [0.46, 0.7], right_knee: [0.54, 0.7],
    left_ankle: [0.46, 0.9], right_ankle: [0.54, 0.9],
  });
  const lyingRight = body({
    nose: [0.9, 0.5], left_shoulder: [0.75, 0.45], right_shoulder: [0.75, 0.55],
    left_hip: [0.5, 0.46], right_hip: [0.5, 0.54], left_knee: [0.3, 0.46], right_knee: [0.3, 0.54],
    left_ankle: [0.1, 0.46], right_ankle: [0.1, 0.54],
  });

  it('scores a standing pose as upright and a sideways one as not', () => {
    expect(uprightScore(standing)).toBe(1);
    expect(uprightScore(lyingRight)).toBe(0);
    expect(uprightScore(body({}))).toBe(0);
  });

  it('chooses the rotation where a convincing, upright person appears', () => {
    const chosen = chooseRotation([
      { rotation: 0, personScore: 0.35, upright: 0 },
      { rotation: 90, personScore: 0.8, upright: 1 },
      { rotation: 180, personScore: 0.4, upright: 0 },
      { rotation: 270, personScore: 0.75, upright: 0.5 },
    ]);
    expect(chosen?.rotation).toBe(90);
    expect(chosen!.confidence).toBeGreaterThan(0.7);
  });

  it('chooses nothing when no rotation found anyone', () => {
    expect(chooseRotation([0, 90, 180, 270].map((r) => ({ rotation: r as 0, personScore: 0, upright: 0 })))).toBeNull();
  });
});

import { summariseSegments } from '@/capture/timing';

describe('frame timing across a pause', () => {
  it('keeps the pause out of the delivered frame rate', () => {
    const a = run(every(1000 / 30, 31)); // one second at 30 fps
    const b = run(every(1000 / 30, 31, 60_000)); // another second, a minute later
    const s = summariseSegments([a, b], 30);
    expect(s.frames).toBe(62);
    expect(s.seconds).toBeCloseTo(2);
    expect(s.deliveredFps).toBeCloseTo(30);
    expect(s.droppedEstimate).toBe(0);
    expect(s.belowRequested).toBe(false);
    // joined naively, the minute between them would look like a 60 second gap
    expect(summariseTiming(run([...every(1000 / 30, 31), ...every(1000 / 30, 31, 60_000)]), 30).droppedEstimate).toBeGreaterThan(1000);
  });

  it('ignores empty segments and handles none at all', () => {
    expect(summariseSegments([emptyCounters(), run(every(1000 / 60, 61))], 60).deliveredFps).toBeCloseTo(60);
    expect(summariseSegments([], 60).deliveredFps).toBeNull();
  });
});
