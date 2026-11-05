import { PoseEngine } from '@/pose/engine';
import type { PoseFrame } from '@/pose/types';

export interface FramePixels {
  /** `uint8` RGB, 256 by 256 by 3, the picture stretched to a square. */
  rgb: Uint8Array;
  /** Size of the upright frame before it was stretched, for angles in pixel space. */
  width: number;
  height: number;
}

export interface AnalysisResult {
  frames: PoseFrame[];
  bowlerCoverage: number | null;
  /** Frames that could not be read or analysed. They are left out, not guessed. */
  failed: number;
  analysed: number;
  /** Upright frame size, from the first frame that was read. */
  size: { width: number; height: number } | null;
  firstError: string | null;
}

/**
 * Runs the pose pipeline over a list of moments in a video, one at a time.
 *
 * `extract` gets the picture at a time, `infer` gives the model's 336 output numbers for a
 * picture. Both are passed in, so the loop is tested with real model output and no phone.
 * A frame that fails is counted and skipped. If more than half fail, or the first ten all fail,
 * it stops and reports the first error, since carrying on would only waste the person's time.
 * Returns null if cancelled.
 */
export async function analyseFrames(args: {
  timesMs: number[];
  extract: (ms: number) => Promise<FramePixels>;
  infer: (rgb: Uint8Array) => Promise<ArrayLike<number>>;
  onProgress?: (done: number, total: number) => void;
  isCancelled?: () => boolean;
}): Promise<AnalysisResult | null> {
  const engine = new PoseEngine({ autoLock: true });
  engine.startRecording();
  let failed = 0;
  let analysed = 0;
  let size: AnalysisResult['size'] = null;
  let firstError: string | null = null;
  const total = args.timesMs.length;

  for (let i = 0; i < total; i++) {
    if (args.isCancelled?.()) return null;
    try {
      const px = await args.extract(args.timesMs[i]!);
      if (!size) size = { width: px.width, height: px.height };
      const out = await args.infer(px.rgb);
      engine.ingest(out, args.timesMs[i]!);
      analysed++;
    } catch (e) {
      failed++;
      firstError ??= e instanceof Error ? e.message : String(e);
      const hopeless = (analysed === 0 && failed >= 10) || (failed > 10 && failed > (i + 1) / 2);
      if (hopeless) break;
    }
    args.onProgress?.(i + 1, total);
  }

  const { frames, bowlerCoverage } = engine.stopRecording();
  return { frames, bowlerCoverage, failed, analysed, size, firstError };
}
