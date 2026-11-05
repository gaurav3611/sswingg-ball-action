import { decode as decodePng } from 'fast-png';
import { MOVENET_INPUT_SIZE } from '@/pose/decode';

/**
 * Turns the bytes of a PNG into the picture the pose model reads: `uint8` RGB, 256 by 256, no
 * alpha. Android writes RGBA or RGB PNGs; grey ones are handled too. Throws if the picture is
 * not the size the model needs, rather than feeding it something that would give nonsense.
 */
export function pngToRgb(bytes: Uint8Array, size = MOVENET_INPUT_SIZE): Uint8Array {
  const img = decodePng(bytes);
  if (img.width !== size || img.height !== size) {
    throw new Error(`Frame is ${img.width} by ${img.height}, expected ${size} by ${size}`);
  }
  if (img.depth !== 8) throw new Error(`Frame has ${img.depth} bits per channel, expected 8`);
  const src = img.data as Uint8Array;
  const n = size * size;
  const out = new Uint8Array(n * 3);
  const ch = img.channels;
  for (let i = 0; i < n; i++) {
    if (ch >= 3) {
      out[i * 3] = src[i * ch]!;
      out[i * 3 + 1] = src[i * ch + 1]!;
      out[i * 3 + 2] = src[i * ch + 2]!;
    } else {
      const g = src[i * ch]!; // grey, or grey with alpha
      out[i * 3] = g;
      out[i * 3 + 1] = g;
      out[i * 3 + 2] = g;
    }
  }
  return out;
}

/**
 * The moments in a video at which to read a frame, in milliseconds: every 1000 / hz ms from the
 * start, up to `maxMs` or the end, whichever is first. The last frame time stays clear of the
 * very end, where some files have no frame to give.
 */
export function frameTimes(durationMs: number, hz: number, maxMs = 60_000): number[] {
  if (!(durationMs > 0) || !(hz > 0)) return [];
  const step = 1000 / hz;
  const end = Math.min(durationMs - 50, maxMs);
  const times: number[] = [];
  for (let t = 0; t <= end; t += step) times.push(Math.round(t));
  return times;
}
