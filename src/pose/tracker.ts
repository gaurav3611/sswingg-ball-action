import type { Box, Detection, TrackedPerson } from './types';

export interface TrackerOptions {
  /** A track that is not matched for this long (ms) is dropped. */
  maxMissedMs: number;
  /** Two boxes with at least this overlap are the same person. */
  minIou: number;
  /**
   * A fast runner moves further between analysed frames than the boxes overlap, so a
   * detection also matches when its centre is within this many box diagonals of the track.
   */
  maxCentreDistance: number;
}

const DEFAULTS: TrackerOptions = { maxMissedMs: 700, minIou: 0.15, maxCentreDistance: 1.0 };

export function iou(a: Box, b: Box): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union <= 0 ? 0 : inter / union;
}

const centre = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const diagonal = (b: Box) => Math.hypot(b.w, b.h);

interface Track {
  id: number;
  box: Box;
  lastSeenT: number;
}

/**
 * Gives each person a stable id from one analysed frame to the next, by matching boxes.
 *
 * This is a matcher on position only. It does not know what a bowler looks like, so two
 * people who cross paths can swap ids. When that matters the user locks the bowler again.
 */
export class PoseTracker {
  private tracks: Track[] = [];
  private nextId = 1;
  private readonly opts: TrackerOptions;

  constructor(opts: Partial<TrackerOptions> = {}) {
    this.opts = { ...DEFAULTS, ...opts };
  }

  reset(): void {
    this.tracks = [];
    this.nextId = 1;
  }

  /** t is the time of this frame in ms. Returns the detections with a track id each. */
  update(t: number, detections: Detection[]): TrackedPerson[] {
    this.tracks = this.tracks.filter((tr) => t - tr.lastSeenT <= this.opts.maxMissedMs);

    const pairs: { track: Track; det: number; iou: number; dist: number }[] = [];
    this.tracks.forEach((track) => {
      detections.forEach((d, di) => {
        const overlap = iou(track.box, d.box);
        const c1 = centre(track.box);
        const c2 = centre(d.box);
        const dist = Math.hypot(c1.x - c2.x, c1.y - c2.y) / Math.max(diagonal(track.box), diagonal(d.box), 1e-6);
        if (overlap >= this.opts.minIou || dist <= this.opts.maxCentreDistance) {
          pairs.push({ track, det: di, iou: overlap, dist });
        }
      });
    });
    // Best overlap first, and the nearer centre breaks ties.
    pairs.sort((a, b) => b.iou - a.iou || a.dist - b.dist);

    const usedTracks = new Set<number>();
    const assigned = new Map<number, Track>();
    for (const p of pairs) {
      if (usedTracks.has(p.track.id) || assigned.has(p.det)) continue;
      usedTracks.add(p.track.id);
      assigned.set(p.det, p.track);
    }

    return detections.map((d, di) => {
      let track = assigned.get(di);
      if (!track) {
        track = { id: this.nextId++, box: d.box, lastSeenT: t };
        this.tracks.push(track);
      }
      track.box = d.box;
      track.lastSeenT = t;
      return { ...d, trackId: track.id };
    });
  }
}
