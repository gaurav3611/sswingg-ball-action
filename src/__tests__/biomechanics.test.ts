import { angleAt, computeAngles, leanFromVertical, lineTilt, METRIC_IDS } from '@/biomechanics/angles';
import { KP, KEYPOINT_NAMES, type KeypointName } from '@/pose/landmarks';
import type { Keypoint } from '@/pose/types';

describe('angleAt', () => {
  it('reads a right angle, a straight line and a fold', () => {
    expect(angleAt({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90);
    expect(angleAt({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(180);
    expect(angleAt({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0.0001 })).toBeLessThan(1);
  });

  it('is 60 degrees in an equilateral triangle', () => {
    expect(angleAt({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: Math.sqrt(3) / 2 })).toBeCloseTo(60);
  });

  it('is NaN when two points coincide', () => {
    expect(angleAt({ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 2 })).toBeNaN();
  });
});

describe('lineTilt and leanFromVertical', () => {
  it('is zero for a level line and positive when the right end is lower (y grows downward)', () => {
    expect(lineTilt({ x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0);
    expect(lineTilt({ x: 0, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(45);
    expect(lineTilt({ x: 0, y: 0 }, { x: 1, y: -1 })).toBeCloseTo(-45);
  });

  it('does not depend on which end is called first', () => {
    expect(lineTilt({ x: 1, y: 1 }, { x: 0, y: 0 })).toBeCloseTo(45);
  });

  it('is zero for an upright trunk and positive when the top leans right', () => {
    expect(leanFromVertical({ x: 0, y: 1 }, { x: 0, y: 0 })).toBeCloseTo(0);
    expect(leanFromVertical({ x: 0, y: 1 }, { x: 1, y: 0 })).toBeCloseTo(45);
    expect(leanFromVertical({ x: 0, y: 1 }, { x: -1, y: 0 })).toBeCloseTo(-45);
  });
});

/** Builds 17 points from a few named ones. Everything else is invisible (score 0). */
function pose(points: Partial<Record<KeypointName, [number, number]>>, score = 0.9): Keypoint[] {
  return KEYPOINT_NAMES.map((n) => {
    const p = points[n];
    return p ? { x: p[0], y: p[1], score } : { x: 0, y: 0, score: 0 };
  });
}

// A wide frame, so that a mistake between 0..1 units and pixels would show.
const frame = { width: 1920, height: 1080 };
const px = (x: number, y: number): [number, number] => [x / frame.width, y / frame.height];

describe('computeAngles', () => {
  it('measures a right-angle elbow in pixels, not in 0 to 1 units', () => {
    // Diagonal segments: a right angle between axis-aligned lines survives any x/y stretching,
    // a diagonal one does not. In 0..1 units on this 16:9 frame this would read about 64 degrees.
    // shoulder (500,500), elbow (600,600), wrist (700,500): 90 degrees at the elbow
    const kps = pose({ right_shoulder: px(500, 500), right_elbow: px(600, 600), right_wrist: px(700, 500) });
    const m = computeAngles(kps, { frame, view: 'side', bowlingArm: 'right' });
    expect(m.elbow_bowling.value).toBeCloseTo(90, 5);
    expect(m.elbow_bowling.kind).toBe('estimated');
    expect(m.elbow_bowling.unit).toBe('deg');
    expect(m.elbow_bowling.confidence).toBeCloseTo(0.9);
  });

  it('reads a straight arm as 180 and picks the arm the bowler uses', () => {
    const kps = pose({
      left_shoulder: px(400, 300), left_elbow: px(400, 500), left_wrist: px(400, 700),
      right_shoulder: px(800, 300), right_elbow: px(800, 500), right_wrist: px(1000, 500),
    });
    const left = computeAngles(kps, { frame, view: 'side', bowlingArm: 'left' });
    expect(left.elbow_bowling.value).toBeCloseTo(180);
    expect(left.elbow_other.value).toBeCloseTo(90);
    const right = computeAngles(kps, { frame, view: 'side', bowlingArm: 'right' });
    expect(right.elbow_bowling.value).toBeCloseTo(90);
  });

  it('reads arm elevation: 0 hanging, 90 level, 180 overhead', () => {
    const shoulder = px(500, 400);
    const hip = px(500, 800);
    const hanging = pose({ right_shoulder: shoulder, right_hip: hip, right_elbow: px(500, 600) });
    const level = pose({ right_shoulder: shoulder, right_hip: hip, right_elbow: px(700, 400) });
    const overhead = pose({ right_shoulder: shoulder, right_hip: hip, right_elbow: px(500, 200) });
    const at = (k: Keypoint[]) => computeAngles(k, { frame, view: 'side', bowlingArm: 'right' }).shoulder_elevation_bowling.value;
    expect(at(hanging)).toBeCloseTo(0);
    expect(at(level)).toBeCloseTo(90);
    expect(at(overhead)).toBeCloseTo(180);
  });

  it('reads knees', () => {
    const kps = pose({ left_hip: px(500, 600), left_knee: px(500, 800), left_ankle: px(500, 1000) });
    expect(computeAngles(kps, { frame, view: 'side', bowlingArm: 'right' }).knee_left.value).toBeCloseTo(180);
  });

  it('reads trunk tilt and, from the front, shoulder and hip tilt', () => {
    const kps = pose({
      left_shoulder: px(900, 300), right_shoulder: px(1100, 360),
      left_hip: px(900, 700), right_hip: px(1100, 700),
    });
    const m = computeAngles(kps, { frame, view: 'front', bowlingArm: 'right' });
    expect(m.hip_line_tilt.value).toBeCloseTo(0);
    expect(m.shoulder_line_tilt.value).toBeGreaterThan(10); // the right shoulder is lower
    expect(m.trunk_tilt.value).toBeCloseTo(0); // mids line up vertically at x=1000
  });

  it('refuses a metric that the camera view cannot show, and says why', () => {
    const kps = pose({ left_shoulder: px(900, 300), right_shoulder: px(1100, 300) });
    const m = computeAngles(kps, { frame, view: 'side', bowlingArm: 'right' });
    expect(m.shoulder_line_tilt.value).toBeNull();
    expect(m.shoulder_line_tilt.kind).toBe('unavailable');
    expect(m.shoulder_line_tilt.reason).toMatch(/side view.*front or rear/i);
  });

  it('is unavailable, with the joint named, when a joint is not visible', () => {
    const kps = pose({ right_shoulder: px(500, 500), right_elbow: px(500, 700) }); // no wrist
    const m = computeAngles(kps, { frame, view: 'side', bowlingArm: 'right' });
    expect(m.elbow_bowling.value).toBeNull();
    expect(m.elbow_bowling.confidence).toBeNull();
    expect(m.elbow_bowling.reason).toMatch(/right wrist/);
  });

  it('uses the weakest joint as the confidence', () => {
    const kps = pose({ right_shoulder: px(500, 500), right_elbow: px(500, 700), right_wrist: px(700, 700) });
    kps[KP.right_wrist] = { ...kps[KP.right_wrist]!, score: 0.35 };
    const m = computeAngles(kps, { frame, view: 'side', bowlingArm: 'right' });
    expect(m.elbow_bowling.confidence).toBeCloseTo(0.35);
  });

  it('is unavailable, not zero, when two joints sit on the same spot', () => {
    const kps = pose({ right_shoulder: px(500, 500), right_elbow: px(500, 500), right_wrist: px(700, 700) });
    const m = computeAngles(kps, { frame, view: 'side', bowlingArm: 'right' });
    expect(m.elbow_bowling.value).toBeNull();
    expect(m.elbow_bowling.reason).toMatch(/overlap/);
  });

  it('answers every metric id, and never calls an estimate measured', () => {
    const m = computeAngles(pose({}), { frame, view: 'front', bowlingArm: 'left' });
    expect(Object.keys(m).sort()).toEqual([...METRIC_IDS].sort());
    for (const id of METRIC_IDS) expect(['estimated', 'unavailable']).toContain(m[id].kind);
  });
});

import { angleSeries, coverage, runs, type SeriesPoint } from '@/biomechanics/series';
import type { PoseTrack } from '@/data/poseFile';

describe('angle series', () => {
  const arm = (angleDeg: number, score = 0.9): Keypoint[] => {
    // shoulder (0.5,0.3), elbow (0.5,0.5), wrist turned `angleDeg` at the elbow, on a square frame
    const rad = (angleDeg * Math.PI) / 180;
    // the shoulder is straight up from the elbow, so turning the wrist by theta from "up" makes theta at the elbow
    const wrist = { x: 0.5 + 0.2 * Math.sin(rad), y: 0.5 - 0.2 * Math.cos(rad) };
    return pose({ right_shoulder: [0.5, 0.3], right_elbow: [0.5, 0.5], right_wrist: [wrist.x, wrist.y] }, score);
  };
  const frameOf = (t: number, kps: Keypoint[] | null, bowlerId: number | null = 1) => ({
    t,
    bowlerId: kps ? bowlerId : null,
    people: kps ? [{ trackId: 1, score: 0.9, box: { x: 0, y: 0, w: 1, h: 1 }, keypoints: kps }] : [],
  });
  const track = (frames: PoseTrack['frames']): PoseTrack => ({ version: 1, modelId: 'm', width: 1000, height: 1000, rotation: 0, frames });

  it('follows the bowler through the recording and leaves gaps where there is no reading', () => {
    const s = angleSeries(track([frameOf(0, arm(90)), frameOf(100, arm(135)), frameOf(200, null), frameOf(300, arm(180))]), 'elbow_bowling', 'side', 'right');
    expect(s.map((p) => p.t)).toEqual([0, 100, 200, 300]);
    expect(s[0]!.value).toBeCloseTo(90, 0);
    expect(s[1]!.value).toBeCloseTo(135, 0);
    expect(s[2]!.value).toBeNull();
    expect(s[3]!.value).toBeCloseTo(180, 0);
  });

  it('ignores people who are not the bowler', () => {
    const f = frameOf(0, arm(90), 99); // the bowler is track 99, who is not in the frame
    expect(angleSeries(track([f]), 'elbow_bowling', 'side', 'right')[0]!.value).toBeNull();
  });

  it('gives no reading when the joints are not confident', () => {
    expect(angleSeries(track([frameOf(0, arm(90, 0.1))]), 'elbow_bowling', 'side', 'right')[0]!.value).toBeNull();
  });

  it('splits at gaps and at long silences, and reports coverage', () => {
    const pts: SeriesPoint[] = [
      { t: 0, value: 10 }, { t: 100, value: 20 }, { t: 200, value: null },
      { t: 300, value: 30 }, { t: 1000, value: 40 }, { t: 1100, value: 50 },
    ];
    expect(runs(pts).map((r) => r.map((p) => p.value))).toEqual([[10, 20], [30], [40, 50]]);
    expect(coverage(pts)).toBeCloseTo(5 / 6);
    expect(coverage([])).toBe(0);
    expect(runs([])).toEqual([]);
  });
});
