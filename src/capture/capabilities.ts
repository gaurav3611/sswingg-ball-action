/**
 * What frame rates this phone can record, worked out from the formats the camera reports.
 * Pure functions, so they can be tested with made-up formats.
 *
 * What a phone reports is what its camera hardware can do. It is not a promise that the
 * recording pipeline keeps up, so every session also stores the rate that was actually
 * delivered (see timing.ts) and the app shows both.
 */
export interface FormatLike {
  videoWidth: number;
  videoHeight: number;
  minFps: number;
  maxFps: number;
}

export const FPS_CHOICES = [30, 60, 120, 240] as const;
export type FpsChoice = (typeof FPS_CHOICES)[number];

/** Below this height a video is too small to find the joints of a bowler far from the lens. */
export const MIN_USEFUL_HEIGHT = 720;

export function supportsFps(f: FormatLike, fps: number): boolean {
  return f.minFps <= fps && fps <= f.maxFps;
}

/** The choices (30, 60, 120, 240) that at least one format can record at, at a useful size. */
export function supportedFps(formats: FormatLike[]): FpsChoice[] {
  return FPS_CHOICES.filter((fps) =>
    formats.some((f) => supportsFps(f, fps) && Math.min(f.videoWidth, f.videoHeight) >= MIN_USEFUL_HEIGHT),
  );
}

/**
 * The format to record with at the given rate: the one closest to `targetHeight` that is not
 * smaller than a useful size. Undefined when no format can record at that rate.
 */
export function bestFormatFor<T extends FormatLike>(formats: T[], fps: number, targetHeight = 1080): T | undefined {
  const usable = formats.filter(
    (f) => supportsFps(f, fps) && Math.min(f.videoWidth, f.videoHeight) >= MIN_USEFUL_HEIGHT,
  );
  usable.sort((a, b) => {
    const da = Math.abs(Math.min(a.videoWidth, a.videoHeight) - targetHeight);
    const db = Math.abs(Math.min(b.videoWidth, b.videoHeight) - targetHeight);
    return da - db || b.videoWidth * b.videoHeight - a.videoWidth * a.videoHeight;
  });
  return usable[0];
}

/** Why a frame rate is not offered, in a sentence, for the setup screen. */
export function whyNotOffered(fps: number): string {
  return `This phone's camera does not report a video mode at ${fps} frames per second.`;
}
