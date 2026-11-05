import { AUTO_LOCK_FRAMES, MAX_RECORDED_PEOPLE, PoseEngine, RELOCK_AFTER_MS } from '@/pose/engine';

/** A tensor with the given people. Each is a box [x, y, w, h] and all 17 points at its centre. */
function tensor(people: { box: [number, number, number, number]; score?: number; kp?: number }[]) {
  const out = new Array(336).fill(0);
  people.slice(0, 6).forEach((p, i) => {
    const [x, y, w, h] = p.box;
    for (let k = 0; k < 17; k++) {
      out[i * 56 + k * 3] = y + h / 2;
      out[i * 56 + k * 3 + 1] = x + w / 2;
      out[i * 56 + k * 3 + 2] = p.kp ?? 0.9;
    }
    [out[i * 56 + 51], out[i * 56 + 52], out[i * 56 + 53], out[i * 56 + 54]] = [y, x, y + h, x + w];
    out[i * 56 + 55] = p.score ?? 0.9;
  });
  return out;
}

const bowlerAt = (x: number) => tensor([{ box: [x, 0.2, 0.2, 0.6] }]);
const MS = 100; // ten analysed frames a second

describe('PoseEngine', () => {
  it('waits, then chooses the only person in view as the bowler', () => {
    const e = new PoseEngine();
    let last = e.ingest(bowlerAt(0.3), 0);
    expect(last.bowlerId).toBeNull();
    for (let i = 1; i <= AUTO_LOCK_FRAMES; i++) last = e.ingest(bowlerAt(0.3), i * MS);
    expect(last.bowlerId).not.toBeNull();
    expect(last.status.state).toBe('tracking');
  });

  it('chooses the largest person when several are in view', () => {
    const e = new PoseEngine();
    let last = e.ingest(new Array(336).fill(0), 0);
    const frame = tensor([
      { box: [0.05, 0.3, 0.1, 0.3] },
      { box: [0.4, 0.1, 0.25, 0.8] }, // the biggest
      { box: [0.8, 0.3, 0.1, 0.3] },
    ]);
    for (let i = 1; i <= AUTO_LOCK_FRAMES + 1; i++) last = e.ingest(frame, i * MS);
    const chosen = last.people.find((p) => p.trackId === last.bowlerId)!;
    expect(chosen.box.h).toBeCloseTo(0.8, 1);
  });

  it('follows the chosen bowler by id while they run, and ignores another person who joins', () => {
    const e = new PoseEngine();
    let id: number | null = null;
    for (let i = 0; i < 20; i++) {
      const x = 0.05 + i * 0.03;
      const r = e.ingest(
        tensor([{ box: [x, 0.2, 0.2, 0.6] }, ...(i >= 8 ? [{ box: [0.85, 0.3, 0.1, 0.4] as [number, number, number, number] }] : [])]),
        i * MS,
      );
      if (i === AUTO_LOCK_FRAMES + 1) id = r.bowlerId;
      if (i > AUTO_LOCK_FRAMES) expect(r.bowlerId).toBe(id);
    }
    expect(id).not.toBeNull();
  });

  it('lets the user choose a different person', () => {
    const e = new PoseEngine({ autoLock: false });
    const frame = tensor([{ box: [0.1, 0.2, 0.2, 0.6] }, { box: [0.6, 0.2, 0.2, 0.6] }]);
    let r = e.ingest(frame, 0);
    expect(r.bowlerId).toBeNull();
    expect(r.status.message).toMatch(/tap the bowler/i);
    e.lockBowler(r.people[1]!.trackId);
    r = e.ingest(frame, MS);
    expect(r.bowlerId).toBe(r.people[1]!.trackId);
  });

  it('reports a lost bowler, and the frame edge when they leave through it', () => {
    const e = new PoseEngine({ autoLock: false });
    const r0 = e.ingest(tensor([{ box: [0.8, 0.2, 0.19, 0.6] }]), 0);
    e.lockBowler(r0.people[0]!.trackId);
    e.ingest(tensor([{ box: [0.8, 0.2, 0.19, 0.6] }]), MS);
    const gone = e.ingest(tensor([]), 2000);
    expect(gone.bowlerId).toBeNull();
    expect(gone.status.state).toBe('left-frame');
  });

  it('chooses again when the bowler has been gone long enough and someone is in view', () => {
    const e = new PoseEngine();
    for (let i = 0; i <= AUTO_LOCK_FRAMES; i++) e.ingest(bowlerAt(0.2), i * MS);
    const first = e.bowlerId;
    const later = 10 * MS + RELOCK_AFTER_MS + 100;
    e.ingest(tensor([]), 10 * MS);
    e.ingest(bowlerAt(0.7), later);
    const r = e.ingest(bowlerAt(0.7), later + MS);
    expect(r.bowlerId).not.toBeNull();
    expect(r.bowlerId).not.toBe(first);
  });

  describe('recording', () => {
    it('keeps frames from the first analysed frame after it starts, with times from zero', () => {
      const e = new PoseEngine();
      for (let i = 0; i < 5; i++) e.ingest(bowlerAt(0.3), i * MS);
      e.startRecording();
      for (let i = 5; i < 15; i++) e.ingest(bowlerAt(0.3), i * MS);
      const { frames, bowlerCoverage } = e.stopRecording();
      expect(frames).toHaveLength(10);
      expect(frames[0]!.t).toBe(0);
      expect(frames[9]!.t).toBeCloseTo(900);
      expect(bowlerCoverage).toBe(1);
      expect(frames.every((f) => f.bowlerId !== null)).toBe(true);
    });

    it('records nothing when not recording, and reports no coverage for an empty recording', () => {
      const e = new PoseEngine();
      e.ingest(bowlerAt(0.3), 0);
      e.startRecording();
      expect(e.stopRecording()).toEqual({ frames: [], bowlerCoverage: null });
    });

    it('reports how much of the time the bowler was followed', () => {
      const e = new PoseEngine({ autoLock: false });
      const r = e.ingest(bowlerAt(0.3), 0);
      e.lockBowler(r.people[0]!.trackId);
      e.startRecording();
      for (let i = 1; i <= 10; i++) e.ingest(i <= 6 ? bowlerAt(0.3) : tensor([]), i * MS);
      const out = e.stopRecording();
      expect(out.bowlerCoverage).toBeCloseTo(0.6);
      expect(out.frames.filter((f) => f.bowlerId === null)).toHaveLength(4);
    });

    it('keeps the bowler first and no more than three people per frame', () => {
      const e = new PoseEngine({ autoLock: false });
      const crowd = tensor([
        { box: [0.0, 0.3, 0.1, 0.2] }, { box: [0.2, 0.3, 0.1, 0.4] }, { box: [0.4, 0.2, 0.2, 0.7] },
        { box: [0.6, 0.3, 0.1, 0.3] }, { box: [0.8, 0.3, 0.1, 0.1] },
      ]);
      const r = e.ingest(crowd, 0);
      const small = r.people.find((p) => p.box.h < 0.15)!;
      e.lockBowler(small.trackId); // choose the smallest: it must still come first
      e.startRecording();
      e.ingest(crowd, MS);
      const { frames } = e.stopRecording();
      expect(frames[0]!.people).toHaveLength(MAX_RECORDED_PEOPLE);
      expect(frames[0]!.people[0]!.trackId).toBe(small.trackId);
    });
  });

  it('reads nanosecond camera timestamps as milliseconds', () => {
    const e = new PoseEngine();
    const base = 5e12;
    e.ingest(bowlerAt(0.3), base);
    e.startRecording();
    for (let i = 1; i <= 5; i++) e.ingest(bowlerAt(0.3), base + i * 100e6); // 100 ms apart, in ns
    const { frames } = e.stopRecording();
    expect(frames.at(-1)!.t - frames[0]!.t).toBeCloseTo(400, 0);
  });

  it('starts again cleanly after a reset', () => {
    const e = new PoseEngine();
    for (let i = 0; i <= AUTO_LOCK_FRAMES; i++) e.ingest(bowlerAt(0.3), i * MS);
    expect(e.bowlerId).not.toBeNull();
    e.reset();
    expect(e.bowlerId).toBeNull();
    expect(e.ingest(bowlerAt(0.3), 0).bowlerId).toBeNull();
  });

  it('refuses a tensor of the wrong size', () => {
    expect(() => new PoseEngine().ingest(new Array(10).fill(0), 0)).toThrow();
  });
});

describe('PoseEngine pausing', () => {
  it('leaves the paused time out of the track', () => {
    const e = new PoseEngine();
    e.ingest(bowlerAt(0.3), 0);
    e.startRecording();
    for (let i = 1; i <= 5; i++) e.ingest(bowlerAt(0.3), i * MS); // recorded: t = 0..400
    e.pauseRecording();
    for (let i = 6; i <= 15; i++) e.ingest(bowlerAt(0.3), i * MS); // one second paused, nothing kept
    e.resumeRecording();
    for (let i = 16; i <= 18; i++) e.ingest(bowlerAt(0.3), i * MS); // recorded after the pause
    const { frames } = e.stopRecording();
    expect(frames).toHaveLength(8);
    expect(frames.slice(0, 5).map((f) => f.t)).toEqual([0, 100, 200, 300, 400]);
    // The first frame after the resume follows the last recorded one, not the paused second.
    // It is out by the one analysis interval that the pause was detected late by.
    const gap = frames[5]!.t - frames[4]!.t;
    expect(gap).toBeGreaterThanOrEqual(100);
    expect(gap).toBeLessThanOrEqual(2 * MS);
    expect(frames[7]!.t).toBeLessThan(900);
  });

  it('does not count paused frames in the bowler coverage', () => {
    const e = new PoseEngine();
    for (let i = 0; i <= AUTO_LOCK_FRAMES; i++) e.ingest(bowlerAt(0.3), i * MS); // the bowler is chosen before recording
    const t0 = (AUTO_LOCK_FRAMES + 1) * MS;
    e.startRecording();
    for (let i = 0; i < 4; i++) e.ingest(bowlerAt(0.3), t0 + i * MS);
    e.pauseRecording();
    for (let i = 4; i < 9; i++) e.ingest(tensor([]), t0 + i * MS); // nobody in view, but paused
    e.resumeRecording();
    for (let i = 9; i < 13; i++) e.ingest(bowlerAt(0.3), t0 + i * MS);
    expect(e.stopRecording().bowlerCoverage).toBe(1);
  });
});
