import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { createVideoPlayer, type VideoPlayer } from 'expo-video';
import type { TfliteModel } from 'react-native-fast-tflite';
import { MOVENET_INPUT_SIZE } from '@/pose/decode';
import type { FramePixels } from './analyseFrames';
import { pngToRgb } from './pixels';

/**
 * The phone-only parts of analysing a video file.
 *
 * Android's frame reader (`MediaMetadataRetriever` with OPTION_CLOSEST, used by expo-video) gives
 * the frame nearest to the requested time, not just the nearest keyframe, already turned
 * upright. The frame is stretched to 256 by 256, written as a PNG, and read back as bytes.
 * Nothing here is covered by the laptop tests: it needs a phone.
 */
export interface FrameSource {
  frameAt(ms: number): Promise<FramePixels>;
  close(): void;
}

export async function openFrameSource(uri: string): Promise<FrameSource> {
  const player: VideoPlayer = createVideoPlayer({ uri });
  // The frame reader needs the file to be open.
  const started = Date.now();
  while (player.status !== 'readyToPlay') {
    if (player.status === 'error') throw new Error('The video could not be opened. It may be damaged or in a format this phone cannot read.');
    if (Date.now() - started > 15_000) throw new Error('The video took too long to open.');
    await new Promise((r) => setTimeout(r, 100));
  }

  return {
    async frameAt(ms: number): Promise<FramePixels> {
      const [thumb] = await player.generateThumbnailsAsync(ms / 1000, { maxWidth: 512, maxHeight: 512 });
      if (!thumb) throw new Error(`No frame at ${ms} ms`);
      const width = thumb.width;
      const height = thumb.height;
      const context = ImageManipulator.manipulate(thumb).resize({ width: MOVENET_INPUT_SIZE, height: MOVENET_INPUT_SIZE });
      const image = await context.renderAsync();
      const saved = await image.saveAsync({ format: SaveFormat.PNG });
      const file = new File(saved.uri);
      try {
        const rgb = pngToRgb(await file.bytes());
        return { rgb, width, height };
      } finally {
        try {
          file.delete();
        } catch {
          // The temporary picture is already gone.
        }
        thumb.release();
        context.release();
        image.release();
      }
    },
    close() {
      player.release();
    },
  };
}

/** Runs the model off the JavaScript thread. */
export async function runModel(model: TfliteModel, rgb: Uint8Array): Promise<Float32Array> {
  const input = rgb.buffer.slice(rgb.byteOffset, rgb.byteOffset + rgb.byteLength) as ArrayBuffer;
  const out = await model.run([input]);
  return new Float32Array(out[0]!);
}
