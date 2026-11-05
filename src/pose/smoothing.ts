import type { Keypoint, TrackedPerson } from './types';

/**
 * One Euro filter (Casiez, Roussel and Vogel, 2012) for one number.
 * It smooths hard when the value is still and lets it through when it moves fast, which suits
 * a bowling arm: a steady head stays steady, and a whipping wrist is not dragged behind.
 */
export class OneEuroFilter {
  private x: number | null = null;
  private dx = 0;
  private lastT: number | null = null;

  /**
   * @param minCutoff lower means smoother when still (Hz)
   * @param beta higher means less lag when moving
   */
  constructor(
    private readonly minCutoff = 1.2,
    private readonly beta = 0.05,
    private readonly dCutoff = 1.0,
  ) {}

  private static alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  /** t is in seconds and must grow. */
  filter(value: number, t: number): number {
    if (this.x === null || this.lastT === null || t <= this.lastT) {
      this.x = value;
      this.lastT = t;
      return value;
    }
    const dt = t - this.lastT;
    const rawDx = (value - this.x) / dt;
    this.dx += OneEuroFilter.alpha(this.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuroFilter.alpha(cutoff, dt) * (value - this.x);
    this.lastT = t;
    return this.x;
  }
}

/** A point under this score is not trusted: it is passed through and does not move the filter. */
export const MIN_TRUSTED_SCORE = 0.2;

/** Smooths the 17 points of each tracked person, with one filter per point and axis. */
export class PoseSmoother {
  private filters = new Map<number, OneEuroFilter[]>();

  reset(): void {
    this.filters.clear();
  }

  /** t is in milliseconds. */
  smooth(person: TrackedPerson, t: number): TrackedPerson {
    let fs = this.filters.get(person.trackId);
    if (!fs) {
      fs = person.keypoints.flatMap(() => [new OneEuroFilter(), new OneEuroFilter()]);
      this.filters.set(person.trackId, fs);
    }
    const seconds = t / 1000;
    const keypoints: Keypoint[] = person.keypoints.map((k, i) => {
      if (k.score < MIN_TRUSTED_SCORE) return k;
      return {
        score: k.score,
        x: fs![i * 2]!.filter(k.x, seconds),
        y: fs![i * 2 + 1]!.filter(k.y, seconds),
      };
    });
    return { ...person, keypoints };
  }
}
