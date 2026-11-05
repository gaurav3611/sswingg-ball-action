/**
 * Checks on the real output of the MoveNet model, not on made-up tensors.
 * The fixture holds what the model wrote for two public domain photographs (credits in the
 * file). It proves that the decoder reads the tensor in the right order and that the angle
 * and rotation logic behaves on real detections. It does not measure how accurate the model
 * is on cricket footage: that needs annotated video, see docs/VALIDATION.md.
 */
import fixture from './fixtures/movenet-real-output.json';
import { computeAngles } from '@/biomechanics/angles';
import { decodeMultiPose } from '@/pose/decode';
import { chooseRotation, uprightScore, ROTATIONS } from '@/pose/geometry';
import { KP } from '@/pose/landmarks';

type Photo = { size: number[]; outputs: Record<string, number[]> };
const photos = fixture.photos as unknown as Record<string, Photo>;
const standing = photos.standing_portrait!;
const bowler = photos.cricket_bowler!;

const upright = (photo: Photo) => decodeMultiPose(photo.outputs['0']!, 0.15)[0]!;

describe('MoveNet output for a standing person', () => {
  const person = upright(standing);
  const k = person.keypoints;
  const confident = (name: keyof typeof KP) => k[KP[name]]!.score >= 0.3;

  it('finds one person with a convincing score', () => {
    expect(decodeMultiPose(standing.outputs['0']!, 0.2)).toHaveLength(1);
    expect(person.score).toBeGreaterThan(0.4);
  });

  it('puts head above shoulders above hips above knees above ankles (so y and x are not swapped)', () => {
    const chain = (['nose', 'left_shoulder', 'left_hip', 'left_knee', 'left_ankle'] as const).filter(confident);
    expect(chain.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < chain.length; i++) expect(k[KP[chain[i]!]]!.y).toBeGreaterThan(k[KP[chain[i - 1]!]]!.y);
    // In pixels, a person standing in a tall photo is taller than wide. (In 0..1 units the
    // photo's own shape would hide this, so it is measured in pixels.)
    const pts = k.filter((q) => q.score >= 0.3);
    const [w, h] = standing.size as [number, number];
    const spanX = (Math.max(...pts.map((q) => q.x)) - Math.min(...pts.map((q) => q.x))) * w;
    const spanY = (Math.max(...pts.map((q) => q.y)) - Math.min(...pts.map((q) => q.y))) * h;
    expect(spanY).toBeGreaterThan(1.5 * spanX);
  });

  it('keeps every confident keypoint inside the box the model drew', () => {
    const { x, y, w, h } = person.box;
    for (const p of k.filter((q) => q.score >= 0.3)) {
      expect(p.x).toBeGreaterThanOrEqual(x - 0.05);
      expect(p.x).toBeLessThanOrEqual(x + w + 0.05);
      expect(p.y).toBeGreaterThanOrEqual(y - 0.05);
      expect(p.y).toBeLessThanOrEqual(y + h + 0.05);
    }
  });

  it('gives sensible angles where the model is sure, and refuses where it is not', () => {
    const frame = { width: standing.size[0]!, height: standing.size[1]! };
    const m = computeAngles(k, { frame, view: 'front', bowlingArm: 'right' });
    // Both knees were found with scores 0.28 and 0.25, under the 0.3 floor: no value, and a reason.
    expect(m.knee_left.kind).toBe('unavailable');
    expect(m.knee_left.reason).toMatch(/left knee.*not visible enough/);
    expect(m.knee_right.value).toBeNull();
    // The elbows, shoulders and hips were found: a bent arm, a level shoulder line, an upright trunk.
    // In the photo the right arm hangs straight down and the left hand rests on the hip
    // (worked out by hand from the keypoints: about 177 and 114 degrees in pixel space).
    expect(m.elbow_bowling.kind).toBe('estimated');
    expect(m.elbow_bowling.value!).toBeGreaterThan(165);
    expect(m.elbow_other.value!).toBeGreaterThan(90);
    expect(m.elbow_other.value!).toBeLessThan(140);
    expect(m.elbow_bowling.confidence!).toBeGreaterThanOrEqual(0.3);
    expect(Math.abs(m.trunk_tilt.value!)).toBeLessThan(15);
    expect(Math.abs(m.shoulder_line_tilt.value!)).toBeLessThan(15);
    for (const metric of Object.values(m)) {
      expect(['estimated', 'unavailable']).toContain(metric.kind);
      if (metric.value === null) expect(metric.reason).toBeTruthy();
    }
  });
});

describe('MoveNet output for a cricket bowler', () => {
  it('is a weak detection, and the app has to say so rather than hide it', () => {
    const [p] = decodeMultiPose(bowler.outputs['0']!, 0.15);
    expect(p).toBeDefined();
    expect(p!.score).toBeLessThan(0.3);
    const m = computeAngles(p!.keypoints, {
      frame: { width: bowler.size[0]!, height: bowler.size[1]! },
      view: 'side',
      bowlingArm: 'right',
    });
    const unavailable = Object.values(m).filter((x) => x.kind === 'unavailable');
    expect(unavailable.length).toBeGreaterThan(0);
    for (const x of unavailable) expect(x.reason).toMatch(/not visible enough|Not readable|overlap/);
  });
});

describe('rotation choice on real detections', () => {
  it.each(['standing_portrait', 'cricket_bowler'])('picks the upright orientation for %s', (name) => {
    const photo = photos[name]!;
    const trials = ROTATIONS.map((rotation) => {
      const people = decodeMultiPose(photo.outputs[String(rotation)]!, 0.01);
      const best = people.sort((a, b) => b.score - a.score)[0];
      return { rotation, personScore: best?.score ?? 0, upright: best ? uprightScore(best.keypoints) : 0 };
    });
    expect(chooseRotation(trials)?.rotation).toBe(0);
  });
});
