import { decodePoseTrack, encodePoseTrack, frameAt, type PoseTrack } from '@/data/poseFile';
import { hasErrors, parseOptionalNumber, validateLogin, validateProfile, validateRegistration } from '@/data/validation';
import type { PoseFrame } from '@/pose/types';

const kps = Array.from({ length: 17 }, (_, i) => ({ x: 0.1 + i / 100, y: 0.2 + i / 100, score: 0.5 + i / 100 }));
const frame = (t: number, bowlerId: number | null = 1): PoseFrame => ({
  t,
  bowlerId,
  people: [{ trackId: 1, score: 0.8, box: { x: 0.1, y: 0.2, w: 0.3, h: 0.6 }, keypoints: kps }],
});
const track = (frames: PoseFrame[]): PoseTrack => ({
  version: 1,
  modelId: 'movenet-multipose-lightning-256',
  width: 1080,
  height: 1920,
  rotation: 90,
  frames,
});

describe('pose track file', () => {
  it('survives a round trip to within a thousandth', () => {
    const t = track([frame(0), frame(83.4), frame(167, null)]);
    const back = decodePoseTrack(encodePoseTrack(t))!;
    expect(back.modelId).toBe(t.modelId);
    expect([back.width, back.height, back.rotation]).toEqual([1080, 1920, 90]);
    expect(back.frames.map((f) => f.t)).toEqual([0, 83, 167]);
    expect(back.frames.map((f) => f.bowlerId)).toEqual([1, 1, null]);
    const p = back.frames[0]!.people[0]!;
    expect(p.trackId).toBe(1);
    expect(p.keypoints).toHaveLength(17);
    p.keypoints.forEach((k, i) => {
      expect(k.x).toBeCloseTo(kps[i]!.x, 3);
      expect(k.y).toBeCloseTo(kps[i]!.y, 3);
      expect(k.score).toBeCloseTo(kps[i]!.score, 3);
    });
    expect(p.box.h).toBeCloseTo(0.6, 3);
  });

  it('keeps a frame with nobody in it', () => {
    const back = decodePoseTrack(encodePoseTrack(track([{ t: 5, bowlerId: null, people: [] }])))!;
    expect(back.frames).toEqual([{ t: 5, bowlerId: null, people: [] }]);
  });

  it('returns null for text that is not a pose track, rather than throwing', () => {
    expect(decodePoseTrack('not json')).toBeNull();
    expect(decodePoseTrack('{"version":2,"frames":[]}')).toBeNull();
    expect(decodePoseTrack('{"version":1}')).toBeNull();
  });

  it('finds the nearest frame, and none when the video is far from any analysed frame', () => {
    const t = track([frame(0), frame(100), frame(200), frame(1200)]);
    expect(frameAt(t, 110)!.t).toBe(100);
    expect(frameAt(t, 160)!.t).toBe(200);
    expect(frameAt(t, -50)!.t).toBe(0);
    expect(frameAt(t, 700)).toBeNull(); // 500 ms from both neighbours, past the 400 ms limit
    expect(frameAt(t, 600)!.t).toBe(200); // 400 ms away is still allowed
    expect(frameAt(track([]), 10)).toBeNull();
  });
});

describe('validation', () => {
  it('checks registration', () => {
    expect(hasErrors(validateRegistration({ name: 'Asha', email: 'asha@example.com', password: 'longenough' }))).toBe(false);
    const e = validateRegistration({ name: 'A', email: 'nope', password: 'short' });
    expect(Object.keys(e).sort()).toEqual(['email', 'name', 'password']);
  });

  it('checks login without asking for a password length', () => {
    expect(hasErrors(validateLogin({ email: 'a@b.co', password: 'x' }))).toBe(false);
    expect(validateLogin({ email: 'a@b.co', password: '' }).password).toBeTruthy();
  });

  it('treats an empty optional number as not given, never as zero', () => {
    expect(parseOptionalNumber('', 5, 90)).toEqual({ value: null });
    expect(parseOptionalNumber('  ', 5, 90)).toEqual({ value: null });
    expect(parseOptionalNumber('17', 5, 90)).toEqual({ value: 17 });
    expect(parseOptionalNumber('1,5', 1, 2)).toEqual({ value: 1.5 });
    expect(parseOptionalNumber('abc', 5, 90).error).toBeTruthy();
    expect(parseOptionalNumber('4', 5, 90).error).toBeTruthy();
    expect(parseOptionalNumber('91', 5, 90).error).toBeTruthy();
  });

  it('lets a profile leave age, height and mass empty', () => {
    const ok = validateProfile({ name: 'Asha', age: '', heightCm: '', massKg: '' });
    expect(hasErrors(ok.errors)).toBe(false);
    expect([ok.age, ok.heightCm, ok.massKg]).toEqual([null, null, null]);
    const bad = validateProfile({ name: '', age: '3', heightCm: '500', massKg: 'x' });
    expect(Object.keys(bad.errors).sort()).toEqual(['age', 'heightCm', 'massKg', 'name']);
  });
});

import { expiredSessions } from '@/data/retention';
import type { Session } from '@/data/types';

describe('retention', () => {
  const DAY = 86_400_000;
  const now = Date.parse('2026-11-05T12:00:00Z');
  const at = (daysAgo: number) => ({ id: String(daysAgo), createdAt: new Date(now - daysAgo * DAY).toISOString() }) as Session;

  it('keeps everything when no limit is set', () => {
    expect(expiredSessions([at(1), at(900)], null, now)).toEqual([]);
  });

  it('returns only sessions older than the limit', () => {
    const list = [at(1), at(29), at(31), at(400)];
    expect(expiredSessions(list, 30, now).map((s) => s.id)).toEqual(['31', '400']);
  });

  it('does not touch a session exactly at the limit', () => {
    expect(expiredSessions([at(30)], 30, now)).toEqual([]);
  });
});

import { clampFps, parseSessionParams } from '@/data/sessionParams';

describe('session parameters', () => {
  it('reads valid choices', () => {
    expect(parseSessionParams({ type: 'target', view: 'rear', fps: '120', intended: 'yorker' })).toEqual({
      type: 'target',
      view: 'rear',
      fps: 120,
      intended: 'yorker',
    });
  });

  it('falls back to defaults for anything missing or not allowed', () => {
    const d = { type: 'nets', view: 'side', fps: 30, intended: 'stock' };
    expect(parseSessionParams({})).toEqual(d);
    expect(parseSessionParams({ type: 'x', view: '<script>', fps: '999', intended: 'nope' })).toEqual(d);
    expect(parseSessionParams({ fps: 'abc' })).toEqual(d);
    expect(parseSessionParams({ type: ['target', 'drill'], fps: ['60'] })).toMatchObject({ type: 'target', fps: 60 });
  });

  it('picks the nearest offered frame rate without going over', () => {
    expect(clampFps(120, [30, 60])).toBe(60);
    expect(clampFps(60, [30, 60, 120])).toBe(60);
    expect(clampFps(30, [60, 120])).toBe(60); // nothing under: the smallest there is
    expect(clampFps(30, [])).toBe(30);
  });
});

import { applyLiveGuard } from '@/data/liveGuard';
import { DEFAULT_SETTINGS } from '@/data/types';

describe('live screen guard', () => {
  it('turns pose tracking off, and says so, when the camera screen did not finish last time', () => {
    const s = applyLiveGuard(DEFAULT_SETTINGS, true);
    expect(s.poseTracking).toBe(false);
    expect(s.poseAutoDisabled).toBe(true);
    expect(s.defaultFps).toBe(DEFAULT_SETTINGS.defaultFps); // nothing else changes
  });

  it('changes nothing after a normal exit', () => {
    expect(applyLiveGuard(DEFAULT_SETTINGS, false)).toBe(DEFAULT_SETTINGS);
  });

  it('does not mark tracking as turned off by the app when the person already turned it off', () => {
    const off = { ...DEFAULT_SETTINGS, poseTracking: false };
    expect(applyLiveGuard(off, true)).toBe(off);
  });
});
