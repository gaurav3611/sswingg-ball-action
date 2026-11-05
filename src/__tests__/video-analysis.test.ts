import { encode } from 'fast-png';
import fixture from './fixtures/movenet-real-output.json';
import { analyseFrames, type FramePixels } from '@/analysis/analyseFrames';
import { frameTimes, pngToRgb } from '@/analysis/pixels';
import { angleSeries, coverage } from '@/biomechanics/series';
import type { PoseTrack } from '@/data/poseFile';

const realTensor = (fixture.photos as unknown as Record<string, { outputs: Record<string, number[]> }>).standing_portrait!.outputs['0']!;
const blank = (): FramePixels => ({ rgb: new Uint8Array(256 * 256 * 3), width: 1280, height: 2351 });

describe('pngToRgb', () => {
  const png = (channels: 1 | 2 | 3 | 4, size = 256, fill = (i: number, c: number) => (i * 7 + c * 31) & 255) => {
    const data = new Uint8Array(size * size * channels);
    for (let i = 0; i < size * size; i++) for (let c = 0; c < channels; c++) data[i * channels + c] = fill(i, c);
    return { bytes: encode({ width: size, height: size, data, depth: 8, channels }), data };
  };

  it('keeps the colours and drops the alpha of an RGBA picture', () => {
    const { bytes, data } = png(4);
    const rgb = pngToRgb(bytes);
    expect(rgb).toHaveLength(256 * 256 * 3);
    for (const i of [0, 1, 999, 65535]) {
      expect([rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]]).toEqual([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
    }
  });

  it('reads RGB and grey pictures', () => {
    const rgbPng = png(3);
    expect(pngToRgb(rgbPng.bytes)[5]).toBe(rgbPng.data[5]);
    const grey = png(1);
    const out = pngToRgb(grey.bytes);
    expect([out[30], out[31], out[32]]).toEqual([grey.data[10], grey.data[10], grey.data[10]]);
  });

  it('refuses a picture of the wrong size instead of feeding the model nonsense', () => {
    expect(() => pngToRgb(png(4, 128).bytes)).toThrow(/128 by 128, expected 256/);
  });

  it('refuses a 16 bit picture', () => {
    const bytes = encode({ width: 256, height: 256, data: new Uint16Array(256 * 256 * 3), depth: 16, channels: 3 });
    expect(() => pngToRgb(bytes)).toThrow(/16 bits/);
  });
});

describe('frameTimes', () => {
  it('reads a frame every 100 ms at 10 Hz from the start', () => {
    expect(frameTimes(1000, 10)).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900]);
  });
  it('stops at the cap and keeps clear of the very end', () => {
    expect(frameTimes(300_000, 10).at(-1)).toBe(60_000);
    expect(frameTimes(60_000, 10).at(-1)).toBeLessThan(60_000);
    expect(frameTimes(1000, 10).at(-1)).toBeLessThanOrEqual(950);
  });
  it('gives nothing for an empty or bad video', () => {
    expect(frameTimes(0, 10)).toEqual([]);
    expect(frameTimes(-5, 10)).toEqual([]);
    expect(frameTimes(1000, 0)).toEqual([]);
  });
});

describe('analyseFrames', () => {
  const times = frameTimes(3000, 10); // 30 frames

  it('follows the bowler through real model output and gives real angles', async () => {
    const progress: number[] = [];
    const r = (await analyseFrames({
      timesMs: times,
      extract: async () => blank(),
      infer: async () => realTensor,
      onProgress: (d) => progress.push(d),
    }))!;
    expect(r.analysed).toBe(30);
    expect(r.failed).toBe(0);
    expect(r.frames).toHaveLength(30);
    expect(r.frames.map((f) => f.t).slice(0, 3)).toEqual([0, 100, 200]); // video time, from zero
    expect(r.size).toEqual({ width: 1280, height: 2351 });
    expect(progress.at(-1)).toBe(30);
    // The bowler is chosen after three frames in view, then followed to the end.
    expect(r.frames.filter((f) => f.bowlerId !== null)).toHaveLength(28);
    expect(r.bowlerCoverage).toBeCloseTo(28 / 30);

    const track: PoseTrack = { version: 1, modelId: 'm', width: r.size!.width, height: r.size!.height, rotation: 0, frames: r.frames };
    const elbow = angleSeries(track, 'elbow_bowling', 'front', 'right').filter((p) => p.value !== null);
    expect(elbow).toHaveLength(28);
    for (const p of elbow) expect(p.value!).toBeGreaterThan(165); // the right arm hangs straight in the photo
    expect(coverage(angleSeries(track, 'elbow_bowling', 'front', 'right'))).toBeCloseTo(28 / 30);
  });

  it('can be cancelled, and then returns nothing', async () => {
    let calls = 0;
    const r = await analyseFrames({
      timesMs: times,
      extract: async () => blank(),
      infer: async () => {
        calls++;
        return realTensor;
      },
      isCancelled: () => calls >= 5,
    });
    expect(r).toBeNull();
    expect(calls).toBe(5);
  });

  it('skips frames that fail and says how many', async () => {
    let n = 0;
    const r = (await analyseFrames({
      timesMs: times,
      extract: async () => {
        if (++n % 3 === 0) throw new Error('decoder hiccup');
        return blank();
      },
      infer: async () => realTensor,
    }))!;
    expect(r.failed).toBe(10);
    expect(r.analysed).toBe(20);
    expect(r.firstError).toBe('decoder hiccup');
  });

  it('gives up early when nothing can be read, and reports the first reason', async () => {
    let calls = 0;
    const r = (await analyseFrames({
      timesMs: frameTimes(60_000, 10),
      extract: async () => {
        calls++;
        throw new Error('No frame at 0 ms');
      },
      infer: async () => realTensor,
    }))!;
    expect(calls).toBe(10);
    expect(r.analysed).toBe(0);
    expect(r.firstError).toBe('No frame at 0 ms');
    expect(r.frames).toEqual([]);
  });

  it('reports no coverage and no people for a video with nobody in it', async () => {
    const r = (await analyseFrames({ timesMs: times, extract: async () => blank(), infer: async () => new Float32Array(336) }))!;
    expect(r.analysed).toBe(30);
    expect(r.bowlerCoverage).toBe(0);
    expect(r.frames.every((f) => f.people.length === 0 && f.bowlerId === null)).toBe(true);
  });
});
