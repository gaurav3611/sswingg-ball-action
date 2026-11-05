import { decodeMultiPose } from './decode';
import { uprightSize, type Rotation, type Size } from './geometry';
import { PoseSmoother } from './smoothing';
import { trackingStatus, type TrackingStatus } from './status';
import { PoseTracker } from './tracker';
import type { Box, PoseFrame, TrackedPerson } from './types';

/** The bowler is chosen on their own after this many analysed frames with someone in view. */
export const AUTO_LOCK_FRAMES = 3;
/** If the chosen bowler is gone this long (ms), the largest person in view is chosen instead. */
export const RELOCK_AFTER_MS = 1500;
/** Most people kept per frame in a recording: the bowler first, then the largest others. */
export const MAX_RECORDED_PEOPLE = 3;

const area = (b: Box) => b.w * b.h;

export interface EngineResult {
  /** Everyone in view, smoothed, for drawing. */
  people: TrackedPerson[];
  bowlerId: number | null;
  status: TrackingStatus;
}

/**
 * Turns the model's output for one frame into tracked, smoothed people, follows the bowler,
 * and keeps the pose track of a recording.
 *
 * It knows nothing about the camera or about React, so the whole pipeline from tensor to
 * saved track can be tested with plain numbers. Input is what the frame processor sends:
 * the model's 336 output numbers and the frame's timestamp.
 */
export class PoseEngine {
  private readonly tracker = new PoseTracker();
  private readonly smoother = new PoseSmoother();
  private lockedId: number | null = null;
  private presentFrames = 0;
  private lastBowlerSeenMs: number | null = null;
  private lastBowlerBox: Box | null = null;
  private lastPeople: TrackedPerson[] = [];

  private firstTs: number | null = null;
  private prevTs: number | null = null;
  /** Converts the camera's timestamps to milliseconds. Learned from the gaps between frames. */
  private tsScale = 1;

  private recording = false;
  private paused = false;
  /** Engine time of the first frame seen while paused, and the total paused time so far. */
  private pauseStartMs: number | null = null;
  private pausedTotalMs = 0;
  private recordStartMs = 0;
  private recorded: PoseFrame[] = [];
  private analysed = 0;
  private bowlerFrames = 0;

  constructor(private readonly opts: { autoLock: boolean; minPersonScore?: number } = { autoLock: true }) {}

  /** Chooses the bowler by track id. Null clears the choice. */
  lockBowler(trackId: number | null): void {
    this.lockedId = trackId;
    this.lastBowlerSeenMs = null;
  }

  get bowlerId(): number | null {
    return this.lockedId;
  }

  /** Starts keeping frames. `ts` is the camera timestamp of the first frame of the recording. */
  startRecording(): void {
    this.recording = true;
    this.paused = false;
    this.pauseStartMs = null;
    this.pausedTotalMs = 0;
    this.recorded = [];
    this.analysed = 0;
    this.bowlerFrames = 0;
    this.recordStartMs = NaN; // set by the first frame after this call
  }

  /**
   * Pauses and resumes keep paused time out of the track, so frame times line up with a video
   * that the recorder also paused. Each pause or resume is found on the next analysed frame, so
   * the track can be out by up to one analysis interval for each of them.
   */
  pauseRecording(): void {
    this.paused = true;
    this.pauseStartMs = null;
  }

  resumeRecording(): void {
    this.paused = false;
  }

  /** Stops, and returns the frames and how well the bowler was followed. */
  stopRecording(): { frames: PoseFrame[]; bowlerCoverage: number | null } {
    this.recording = false;
    return {
      frames: this.recorded,
      bowlerCoverage: this.analysed === 0 ? null : this.bowlerFrames / this.analysed,
    };
  }

  reset(): void {
    this.tracker.reset();
    this.smoother.reset();
    this.lockedId = null;
    this.presentFrames = 0;
    this.lastBowlerSeenMs = null;
    this.lastBowlerBox = null;
    this.lastPeople = [];
    this.firstTs = null;
    this.prevTs = null;
    this.tsScale = 1;
    this.recording = false;
    this.paused = false;
    this.pauseStartMs = null;
    this.pausedTotalMs = 0;
    this.recorded = [];
  }

  /** Time in ms of a camera timestamp, counted from the first frame this engine saw. */
  private toMs(ts: number): number {
    if (this.firstTs === null) {
      this.firstTs = ts;
      this.prevTs = ts;
      return 0;
    }
    if (this.prevTs !== null && this.tsScale === 1 && ts - this.prevTs > 50_000) this.tsScale = 1e-6;
    this.prevTs = ts;
    return (ts - this.firstTs) * this.tsScale;
  }

  ingest(output: ArrayLike<number>, ts: number): EngineResult {
    const nowMs = this.toMs(ts);
    const detections = decodeMultiPose(output, this.opts.minPersonScore ?? 0.2);
    const people = this.tracker.update(nowMs, detections).map((p) => this.smoother.smooth(p, nowMs));
    this.lastPeople = people;

    this.presentFrames = people.length > 0 ? this.presentFrames + 1 : 0;
    const bowlerGone = this.lockedId !== null && this.lastBowlerSeenMs !== null && nowMs - this.lastBowlerSeenMs > RELOCK_AFTER_MS;
    if (this.opts.autoLock && people.length > 0 && ((this.lockedId === null && this.presentFrames >= AUTO_LOCK_FRAMES) || bowlerGone)) {
      const largest = people.reduce((a, b) => (area(b.box) > area(a.box) ? b : a));
      this.lockedId = largest.trackId;
      this.lastBowlerSeenMs = null;
    }

    const bowler = this.lockedId === null ? undefined : people.find((p) => p.trackId === this.lockedId);
    if (bowler) {
      this.lastBowlerSeenMs = nowMs;
      this.lastBowlerBox = bowler.box;
    } else if (this.lockedId !== null && this.lastBowlerSeenMs === null) {
      // Chosen but not yet seen: start the clock so "lost" can be reported.
      this.lastBowlerSeenMs = nowMs;
    }

    const status = trackingStatus({
      lockedId: this.lockedId,
      people,
      msSinceBowlerSeen: this.lastBowlerSeenMs === null ? null : nowMs - this.lastBowlerSeenMs,
      lastBowlerBox: this.lastBowlerBox,
    });

    if (this.recording && this.paused) {
      if (this.pauseStartMs === null) this.pauseStartMs = nowMs;
    } else if (this.recording) {
      if (this.pauseStartMs !== null) {
        this.pausedTotalMs += nowMs - this.pauseStartMs;
        this.pauseStartMs = null;
      }
      if (Number.isNaN(this.recordStartMs)) this.recordStartMs = nowMs;
      this.analysed++;
      if (bowler) this.bowlerFrames++;
      const ordered = [...people].sort((a, b) =>
        a.trackId === this.lockedId ? -1 : b.trackId === this.lockedId ? 1 : area(b.box) - area(a.box),
      );
      this.recorded.push({
        t: nowMs - this.recordStartMs - this.pausedTotalMs,
        bowlerId: bowler ? bowler.trackId : null,
        people: ordered.slice(0, MAX_RECORDED_PEOPLE),
      });
    }

    return { people, bowlerId: bowler ? bowler.trackId : null, status };
  }

  /** The people of the latest frame, for tapping to choose the bowler. */
  get latestPeople(): TrackedPerson[] {
    return this.lastPeople;
  }
}

/** Upright frame size for a raw frame turned by `rotation`. Re-exported for the camera code. */
export const frameUprightSize = (raw: Size, rotation: Rotation) => uprightSize(raw, rotation);
