import { MOVENET_MAX_PEOPLE, decodeMultiPose } from '@/pose/decode';
import { KP } from '@/pose/landmarks';
import { PoseTracker, iou } from '@/pose/tracker';
import { OneEuroFilter, PoseSmoother } from '@/pose/smoothing';
import { LOST_AFTER_MS, trackingStatus } from '@/pose/status';
import type { Detection, Keypoint, TrackedPerson } from '@/pose/types';

/** One person's 56 numbers: 17 points of (y, x, score), then the box and the person score. */
function personSlot(opts: { box: [number, number, number, number]; score: number; point?: [number, number, number] }) {
  const slot = new Array(56).fill(0);
  const [y, x, s] = opts.point ?? [0.5, 0.5, 0.9];
  for (let k = 0; k < 17; k++) {
    slot[k * 3] = y;
    slot[k * 3 + 1] = x;
    slot[k * 3 + 2] = s;
  }
  [slot[51], slot[52], slot[53], slot[54]] = opts.box; // ymin, xmin, ymax, xmax
  slot[55] = opts.score;
  return slot;
}

const tensor = (slots: number[][]) => {
  const out = new Array(MOVENET_MAX_PEOPLE * 56).fill(0);
  slots.forEach((s, i) => s.forEach((v, j) => (out[i * 56 + j] = v)));
  return out;
};

describe('decodeMultiPose', () => {
  it('reads two people and skips empty slots', () => {
    const out = tensor([
      personSlot({ box: [0.1, 0.2, 0.9, 0.4], score: 0.8, point: [0.3, 0.25, 0.7] }),
      personSlot({ box: [0.2, 0.6, 0.8, 0.9], score: 0.5 }),
    ]);
    const people = decodeMultiPose(out);
    expect(people).toHaveLength(2);
    expect(people[0]!.keypoints).toHaveLength(17);
    expect(people[0]!.keypoints[0]).toEqual({ y: 0.3, x: 0.25, score: 0.7 });
    expect(people[0]!.box.x).toBeCloseTo(0.2);
    expect(people[0]!.box.y).toBeCloseTo(0.1);
    expect(people[0]!.box.w).toBeCloseTo(0.2);
    expect(people[0]!.box.h).toBeCloseTo(0.8);
    expect(people[0]!.score).toBeCloseTo(0.8);
  });

  it('finds no one in an empty tensor', () => {
    expect(decodeMultiPose(new Float32Array(336))).toEqual([]);
  });

  it('ignores people below the score threshold', () => {
    const out = tensor([personSlot({ box: [0, 0, 1, 1], score: 0.1 })]);
    expect(decodeMultiPose(out, 0.2)).toEqual([]);
    expect(decodeMultiPose(out, 0.05)).toHaveLength(1);
  });

  it('clamps values the model writes outside 0 to 1', () => {
    const out = tensor([personSlot({ box: [-0.1, -0.2, 1.2, 1.1], score: 0.9, point: [1.4, -0.3, 1.1] })]);
    const [p] = decodeMultiPose(out);
    expect(p!.box).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    expect(p!.keypoints[0]).toEqual({ y: 1, x: 0, score: 1 });
  });

  it('refuses a tensor of the wrong size instead of guessing', () => {
    expect(() => decodeMultiPose(new Float32Array(100))).toThrow(/expected 336/);
  });

  it('treats NaN scores as no person', () => {
    const out = tensor([personSlot({ box: [0, 0, 1, 1], score: NaN })]);
    expect(decodeMultiPose(out)).toEqual([]);
  });
});

const det = (x: number, y: number, w = 0.2, h = 0.5): Detection => ({
  box: { x, y, w, h },
  score: 0.9,
  keypoints: Array.from({ length: 17 }, () => ({ x: x + w / 2, y: y + h / 2, score: 0.9 })),
});

describe('PoseTracker', () => {
  it('computes overlap', () => {
    expect(iou({ x: 0, y: 0, w: 1, h: 1 }, { x: 0, y: 0, w: 1, h: 1 })).toBe(1);
    expect(iou({ x: 0, y: 0, w: 1, h: 1 }, { x: 2, y: 2, w: 1, h: 1 })).toBe(0);
    expect(iou({ x: 0, y: 0, w: 2, h: 1 }, { x: 1, y: 0, w: 2, h: 1 })).toBeCloseTo(1 / 3);
  });

  it('keeps an id while a person moves', () => {
    const t = new PoseTracker();
    const a = t.update(0, [det(0.1, 0.2)])[0]!.trackId;
    const b = t.update(100, [det(0.14, 0.2)])[0]!.trackId;
    const c = t.update(200, [det(0.19, 0.2)])[0]!.trackId;
    expect([b, c]).toEqual([a, a]);
  });

  it('keeps two people apart', () => {
    const t = new PoseTracker();
    const first = t.update(0, [det(0.1, 0.2), det(0.7, 0.2)]);
    const second = t.update(100, [det(0.72, 0.2), det(0.12, 0.2)]); // listed in the other order
    expect(second[0]!.trackId).toBe(first[1]!.trackId);
    expect(second[1]!.trackId).toBe(first[0]!.trackId);
    expect(first[0]!.trackId).not.toBe(first[1]!.trackId);
  });

  it('follows a fast runner whose boxes no longer overlap', () => {
    const t = new PoseTracker();
    const a = t.update(0, [det(0.1, 0.2, 0.1, 0.4)])[0]!.trackId;
    const b = t.update(150, [det(0.3, 0.2, 0.1, 0.4)])[0]!.trackId; // moved two body widths
    expect(b).toBe(a);
  });

  it('gives a new person a new id and drops a track that stays missing', () => {
    const t = new PoseTracker({ maxMissedMs: 500 });
    const a = t.update(0, [det(0.1, 0.2)])[0]!.trackId;
    t.update(100, []);
    expect(t.update(200, [det(0.1, 0.2)])[0]!.trackId).toBe(a); // back within the limit
    t.update(300, []);
    const later = t.update(2000, [det(0.1, 0.2)])[0]!.trackId; // far past the limit
    expect(later).not.toBe(a);
  });

  it('never gives one track to two detections', () => {
    const t = new PoseTracker();
    t.update(0, [det(0.4, 0.2)]);
    const ids = t.update(100, [det(0.4, 0.2), det(0.42, 0.2)]).map((p) => p.trackId);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('OneEuroFilter', () => {
  it('passes the first value and keeps a constant value constant', () => {
    const f = new OneEuroFilter();
    expect(f.filter(0.5, 0)).toBe(0.5);
    for (let i = 1; i < 20; i++) expect(f.filter(0.5, i / 30)).toBeCloseTo(0.5, 10);
  });

  it('removes jitter around a still point', () => {
    const f = new OneEuroFilter();
    const noisy = (i: number) => 0.5 + (i % 2 ? 0.01 : -0.01);
    let last = 0;
    for (let i = 0; i < 60; i++) last = f.filter(noisy(i), i / 30);
    expect(Math.abs(last - 0.5)).toBeLessThan(0.006); // under the 0.01 swing
  });

  it('follows a fast move without lagging far behind', () => {
    const f = new OneEuroFilter();
    f.filter(0, 0);
    let v = 0;
    for (let i = 1; i <= 10; i++) v = f.filter(i * 0.1, i / 30); // 3 units per second
    expect(v).toBeGreaterThan(0.7);
    expect(v).toBeLessThanOrEqual(1);
  });

  it('ignores a time that does not advance', () => {
    const f = new OneEuroFilter();
    f.filter(1, 1);
    expect(f.filter(2, 1)).toBe(2);
  });
});

describe('PoseSmoother', () => {
  const person = (score: number, x: number): TrackedPerson => ({
    ...det(0.1, 0.1),
    trackId: 1,
    keypoints: Array.from({ length: 17 }, (): Keypoint => ({ x, y: 0.5, score })),
  });

  it('passes untrusted points through untouched', () => {
    const s = new PoseSmoother();
    s.smooth(person(0.9, 0.5), 0);
    const out = s.smooth(person(0.05, 0.9), 33);
    expect(out.keypoints[KP.nose]).toEqual({ x: 0.9, y: 0.5, score: 0.05 });
  });

  it('keeps separate filters per person', () => {
    const s = new PoseSmoother();
    s.smooth({ ...person(0.9, 0.2), trackId: 1 }, 0);
    const other = s.smooth({ ...person(0.9, 0.8), trackId: 2 }, 0);
    expect(other.keypoints[0]!.x).toBe(0.8);
  });
});

describe('trackingStatus', () => {
  const tracked = (id: number, score: number): TrackedPerson => ({
    ...det(0.3, 0.2),
    trackId: id,
    keypoints: Array.from({ length: 17 }, () => ({ x: 0.4, y: 0.4, score })),
  });
  const base = { lockedId: 1, msSinceBowlerSeen: 0, lastBowlerBox: { x: 0.3, y: 0.2, w: 0.2, h: 0.5 } };

  it('asks the user to step in, or tap, before a bowler is chosen', () => {
    expect(trackingStatus({ ...base, lockedId: null, people: [] }).message).toMatch(/step into the frame/i);
    expect(trackingStatus({ ...base, lockedId: null, people: [tracked(1, 0.9)] }).message).toMatch(/tap the bowler/i);
  });

  it('reports tracking and low confidence', () => {
    expect(trackingStatus({ ...base, people: [tracked(1, 0.9)] }).state).toBe('tracking');
    expect(trackingStatus({ ...base, people: [tracked(1, 0.2)] }).state).toBe('low-confidence');
  });

  it('waits briefly before calling the bowler lost', () => {
    const args = { ...base, people: [tracked(2, 0.9)] };
    expect(trackingStatus({ ...args, msSinceBowlerSeen: LOST_AFTER_MS - 1 }).state).toBe('tracking');
    expect(trackingStatus({ ...args, msSinceBowlerSeen: LOST_AFTER_MS + 1 }).state).toBe('lost');
  });

  it('says the bowler left the frame when they vanish at an edge', () => {
    const s = trackingStatus({
      lockedId: 1,
      people: [],
      msSinceBowlerSeen: 2000,
      lastBowlerBox: { x: 0.8, y: 0.2, w: 0.2, h: 0.5 },
    });
    expect(s.state).toBe('left-frame');
  });
});
