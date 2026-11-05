/**
 * Frame timing, counted frame by frame while recording.
 *
 * The camera's frame processor sees every frame. It cannot send each timestamp to JavaScript
 * cheaply, so it keeps four numbers (this type) and the session summary is worked out from
 * them when recording stops.
 */
export interface FrameCounters {
  count: number;
  firstTs: number;
  lastTs: number;
  /** The longest gap between two frames, in the unit of the timestamps. */
  maxGap: number;
}

export const emptyCounters = (): FrameCounters => ({ count: 0, firstTs: 0, lastTs: 0, maxGap: 0 });

/** Adds one frame. Marked as a worklet so the frame processor can call it. */
export function addFrame(c: FrameCounters, ts: number): FrameCounters {
  'worklet';
  if (c.count === 0) return { count: 1, firstTs: ts, lastTs: ts, maxGap: 0 };
  return { count: c.count + 1, firstTs: c.firstTs, lastTs: ts, maxGap: Math.max(c.maxGap, ts - c.lastTs) };
}

export interface TimingSummary {
  /** Frames the camera delivered. */
  frames: number;
  /** Seconds from the first to the last frame. */
  seconds: number;
  /** Frames per second that really arrived. Null with fewer than two frames. */
  deliveredFps: number | null;
  /** The longest gap between two frames, in milliseconds. */
  longestGapMs: number;
  /** Frames missing compared with the requested rate. An estimate, never negative. */
  droppedEstimate: number;
  /** True when the delivered rate is under 90 percent of the requested one. */
  belowRequested: boolean;
}

/**
 * Camera timestamps are milliseconds on most devices. If the average gap between frames is
 * over 100,000 units they cannot be milliseconds (that would be a frame every 100 seconds),
 * so they are read as nanoseconds.
 */
function toMs(c: FrameCounters): { ms: number; gapMs: number } {
  const span = c.lastTs - c.firstTs;
  const avgGap = c.count > 1 ? span / (c.count - 1) : 0;
  const scale = avgGap > 100_000 ? 1e-6 : 1;
  return { ms: span * scale, gapMs: c.maxGap * scale };
}

export function summariseTiming(c: FrameCounters, requestedFps: number): TimingSummary {
  const { ms, gapMs } = toMs(c);
  const seconds = ms / 1000;
  const deliveredFps = c.count > 1 && seconds > 0 ? (c.count - 1) / seconds : null;
  const expected = Math.round(seconds * requestedFps) + 1;
  return {
    frames: c.count,
    seconds,
    deliveredFps,
    longestGapMs: gapMs,
    droppedEstimate: Math.max(0, expected - c.count),
    belowRequested: deliveredFps !== null && deliveredFps < 0.9 * requestedFps,
  };
}

/**
 * A recording that was paused has one set of counters for each stretch between a start or
 * resume and the next pause or stop. Joining them keeps the paused time out of the frame rate.
 */
export function summariseSegments(segments: FrameCounters[], requestedFps: number): TimingSummary {
  const parts = segments.filter((c) => c.count > 0).map((c) => summariseTiming(c, requestedFps));
  const frames = parts.reduce((n, p) => n + p.frames, 0);
  const seconds = parts.reduce((n, p) => n + p.seconds, 0);
  const intervals = parts.reduce((n, p) => n + Math.max(0, p.frames - 1), 0);
  const deliveredFps = intervals > 0 && seconds > 0 ? intervals / seconds : null;
  return {
    frames,
    seconds,
    deliveredFps,
    longestGapMs: parts.reduce((m, p) => Math.max(m, p.longestGapMs), 0),
    droppedEstimate: parts.reduce((n, p) => n + p.droppedEstimate, 0),
    belowRequested: deliveredFps !== null && deliveredFps < 0.9 * requestedFps,
  };
}
