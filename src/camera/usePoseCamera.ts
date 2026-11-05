import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NitroModules } from 'react-native-nitro-modules';
import { runAtTargetFps, useFrameProcessor } from 'react-native-vision-camera';
import { useRunOnJS, useSharedValue } from 'react-native-worklets-core';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { MODEL_ID, MODEL_SOURCE } from './modelSource';
import { useModel } from './useModel';

export { MODEL_ID };
import { ema, landmarkSummary } from '@/capture/diagnostics';
import { addFrame, emptyCounters, summariseSegments, summariseTiming, type FrameCounters, type TimingSummary } from '@/capture/timing';
import { decodeMultiPose, MOVENET_INPUT_SIZE } from '@/pose/decode';
import { PoseEngine } from '@/pose/engine';
import { ROTATIONS, chooseRotation, uprightScore, uprightSize, type Rotation, type Size } from '@/pose/geometry';
import type { TrackingStatus } from '@/pose/status';
import type { PoseFrame, TrackedPerson } from '@/pose/types';


/** How often the pose model runs, per second: while recording, and while only watching. */
export const RECORD_HZ = 10;
export const IDLE_HZ = 5;
/**
 * While checking the camera orientation the model runs once per call on a different turn of the
 * frame each time, so no single call holds the camera thread for four inferences in a row.
 */
const PROBE_HZ = 8;
const PROBE_FRAMES = 2;
const PROBE_MIN_CONFIDENCE = 0.15;

export interface OrientationCheck {
  state: 'checking' | 'ready';
  /** Shown to the user while checking. */
  note: string;
  rotation: Rotation | null;
}

/** What the diagnostics panel shows about the pose model, updated as frames are analysed. */
export interface PoseDiagnostics {
  modelPath: string | null;
  /** Analysed frames that have come back from the model since the screen opened. */
  analysedFrames: number;
  /** Average time the model took for one frame, in ms. */
  latencyMs: number | null;
  /** Points of the bowler (or the most visible person) that the model is at least 0.3 sure of. */
  landmarks: number;
  meanConfidence: number | null;
  lastError: string | null;
}

export interface RecordingResult {
  frames: PoseFrame[];
  bowlerCoverage: number | null;
  timing: TimingSummary;
  rotation: Rotation | null;
  upright: Size | null;
}

type Trial = { rotation: Rotation; personScore: number; upright: number };
const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

/**
 * Everything between the camera and the pose engine.
 *
 * The frame processor runs on the camera's own thread. For every frame it counts the frame (so
 * the real frame rate can be reported). A few times a second it also shrinks the whole frame to
 * 256 by 256, runs MoveNet, and sends the 336 output numbers to JavaScript, where PoseEngine does
 * the rest. Until the orientation check has run, it tries all four turns of the frame and
 * learns which one shows an upright person.
 */
export function usePoseCamera(args: {
  /** False turns pose tracking off: no model is loaded and no frame is analysed. */
  enabled: boolean;
  requestedFps: number;
  /** Turns already learned for each way the phone was held, keyed by the frame's orientation. */
  knownRotations: Record<string, Rotation>;
  onRotationLearned: (orientation: string, rotation: Rotation) => void;
}) {
  const plugin = useModel(MODEL_SOURCE, args.enabled);
  const model = plugin.state === 'loaded' ? plugin.model : undefined;
  // Vision Camera 4 cannot use a Nitro object in a worklet directly, so it is boxed first.
  const boxed = useMemo(() => (model ? NitroModules.box(model) : undefined), [model]);
  const { resize } = useResizePlugin();

  const engine = useRef(new PoseEngine({ autoLock: true })).current;
  const counters = useSharedValue<FrameCounters>(emptyCounters());
  const counting = useSharedValue(false);
  // Counts every frame all the time, so the real camera frame rate can be shown before recording.
  const viewCounters = useSharedValue<FrameCounters>(emptyCounters());
  const rotationSV = useSharedValue(0);
  const hzSV = useSharedValue(IDLE_HZ);
  const probeIdx = useSharedValue(0);
  const probing = useSharedValue(true);
  const segments = useRef<FrameCounters[]>([]);

  const [people, setPeople] = useState<TrackedPerson[]>([]);
  const [bowlerId, setBowlerId] = useState<number | null>(null);
  const [status, setStatus] = useState<TrackingStatus>({ state: 'searching', message: 'Starting.' });
  const [upright, setUpright] = useState<Size | null>(null);
  const [diag, setDiag] = useState<PoseDiagnostics>({ modelPath: null, analysedFrames: 0, latencyMs: null, landmarks: 0, meanConfidence: null, lastError: null });
  const latency = useRef<number | null>(null);
  const analysed = useRef(0);
  const [check, setCheck] = useState<OrientationCheck>({ state: 'checking', note: 'Checking the camera orientation. Stand in view.', rotation: null });

  const orientationRef = useRef<string | null>(null);
  const rotationRef = useRef<Rotation | null>(null);
  const uprightRef = useRef<Size | null>(null);
  const trials = useRef<Record<number, Trial[]>>({ 0: [], 90: [], 180: [], 270: [] });
  const known = useRef(args.knownRotations);
  known.current = args.knownRotations;
  const learned = useRef(args.onRotationLearned);
  learned.current = args.onRotationLearned;
  const errors = useRef(0);

  const beginProbe = useCallback(() => {
    trials.current = { 0: [], 90: [], 180: [], 270: [] };
    probing.value = true;
    rotationRef.current = null;
    engine.reset();
    setCheck({ state: 'checking', note: 'Checking the camera orientation. Stand in view.', rotation: null });
  }, [engine, probing]);

  // Runs on the JavaScript thread, called from the frame processor.
  const onTensors = useRunOnJS(
    (tensors: number[][], rotations: number[], ts: number, width: number, height: number, orientation: string, tookMs: number) => {
      try {
        // The phone was turned: use what is known for the new orientation, or check again.
        if (orientationRef.current !== orientation) {
          orientationRef.current = orientation;
          const saved = known.current[orientation];
          if (saved !== undefined) {
            rotationSV.value = saved;
            probing.value = false;
            rotationRef.current = saved;
            engine.reset();
            setCheck({ state: 'ready', note: 'Camera orientation known.', rotation: saved });
          } else {
            beginProbe();
          }
          return;
        }

        if (rotationRef.current === null) {
          // One rotation arrives per call. Keep the last few readings of each.
          const rotation = rotations[0] as Rotation;
          const best = decodeMultiPose(tensors[0]!, 0.05).sort((x, y) => y.score - x.score)[0];
          const list = trials.current[rotation] ?? [];
          trials.current[rotation] = [...list, { rotation, personScore: best?.score ?? 0, upright: best ? uprightScore(best.keypoints) : 0 }].slice(-PROBE_FRAMES);
          if (ROTATIONS.some((r) => (trials.current[r]?.length ?? 0) < PROBE_FRAMES)) return;
          const merged = ROTATIONS.map((r) => {
            const col = trials.current[r]!;
            return { rotation: r, personScore: mean(col.map((c) => c.personScore)), upright: mean(col.map((c) => c.upright)) };
          });
          const choice = chooseRotation(merged);
          if (choice && choice.confidence >= PROBE_MIN_CONFIDENCE) {
            rotationSV.value = choice.rotation;
            probing.value = false;
            rotationRef.current = choice.rotation;
            engine.reset();
            learned.current(orientation, choice.rotation);
            setCheck({ state: 'ready', note: `Camera orientation found (confidence ${choice.confidence.toFixed(2)}).`, rotation: choice.rotation });
          } else {
            setCheck({ state: 'checking', note: 'No one found yet. Stand in view with your whole body visible.', rotation: null });
            trials.current = { 0: [], 90: [], 180: [], 270: [] };
          }
          return;
        }

        const size = uprightSize({ width, height }, rotationRef.current);
        if (!uprightRef.current || uprightRef.current.width !== size.width || uprightRef.current.height !== size.height) {
          uprightRef.current = size;
          setUpright(size);
        }
        const result = engine.ingest(tensors[0]!, ts);
        latency.current = ema(latency.current, tookMs);
        analysed.current++;
        const shown = result.people.find((p) => p.trackId === result.bowlerId) ?? result.people[0];
        const lm = landmarkSummary(shown ? shown.keypoints.map((k) => k.score) : []);
        setDiag((d) => ({ ...d, analysedFrames: analysed.current, latencyMs: latency.current, landmarks: lm.count, meanConfidence: lm.meanScore }));
        setPeople(result.people);
        setBowlerId(result.bowlerId);
        setStatus(result.status);
      } catch (e) {
        // A bad frame is skipped. Show the problem only if it keeps happening.
        errors.current++;
        const message = e instanceof Error ? e.message : String(e);
        setDiag((d) => ({ ...d, lastError: message }));
        if (errors.current === 5) setStatus({ state: 'lost', message: 'The pose model returned unreadable results.' });
      }
    },
    [engine, beginProbe],
  );

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      viewCounters.value = addFrame(viewCounters.value, frame.timestamp);
      if (counting.value) counters.value = addFrame(counters.value, frame.timestamp);
      if (boxed == null) return;
      runAtTargetFps(probing.value ? PROBE_HZ : hzSV.value, () => {
        'worklet';
        const started = Date.now();
        const tflite = boxed.unbox();
        let turn = rotationSV.value;
        if (probing.value) {
          turn = [0, 90, 180, 270][probeIdx.value % 4]!;
          probeIdx.value = probeIdx.value + 1;
        }
        const rotations = [turn];
        const outputs: number[][] = [];
        for (const r of rotations) {
          // The whole frame is used: an explicit crop stops the plugin from centre-cropping to a square.
          const resized = resize(frame, {
            crop: { x: 0, y: 0, width: frame.width, height: frame.height },
            scale: { width: MOVENET_INPUT_SIZE, height: MOVENET_INPUT_SIZE },
            rotation: r === 90 ? '90deg' : r === 180 ? '180deg' : r === 270 ? '270deg' : '0deg',
            pixelFormat: 'rgb',
            dataType: 'uint8',
          });
          // The plugin builds the array from a plain ArrayBuffer, so this slice is one too.
          const input = resized.buffer.slice(resized.byteOffset, resized.byteOffset + resized.byteLength) as ArrayBuffer;
          const result = tflite.runSync([input]);
          outputs.push(Array.from(new Float32Array(result[0]!)));
        }
        onTensors(outputs, rotations, frame.timestamp, frame.width, frame.height, frame.orientation, Date.now() - started);
      });
    },
    [boxed, resize, onTensors],
  );

  // Frames in the preview before the model has loaded are not analysed.
  useEffect(() => {
    if (plugin.state === 'error') errors.current = 0;
  }, [plugin.state]);

  const startRecording = useCallback(() => {
    segments.current = [];
    counters.value = emptyCounters();
    counting.value = true;
    hzSV.value = RECORD_HZ;
    engine.startRecording();
  }, [counters, counting, engine, hzSV]);

  const pauseRecording = useCallback(() => {
    counting.value = false;
    segments.current.push(counters.value);
    counters.value = emptyCounters();
    engine.pauseRecording();
  }, [counters, counting, engine]);

  const resumeRecording = useCallback(() => {
    counting.value = true;
    engine.resumeRecording();
  }, [counting, engine]);

  const stopRecording = useCallback((): RecordingResult => {
    counting.value = false;
    hzSV.value = IDLE_HZ;
    segments.current.push(counters.value);
    const timing = summariseSegments(segments.current, args.requestedFps);
    const { frames, bowlerCoverage } = engine.stopRecording();
    return { frames, bowlerCoverage, timing, rotation: rotationRef.current, upright: uprightRef.current };
  }, [args.requestedFps, counters, counting, engine, hzSV]);

  /** The frame rate delivered so far in this recording, for showing while it runs. */
  const peekTiming = useCallback(
    (): TimingSummary => summariseSegments([...segments.current, counters.value], args.requestedFps),
    [args.requestedFps, counters],
  );

  /** Frames per second that arrived since the last call. Call about once a second. */
  const readLiveFps = useCallback((): number | null => {
    const c = viewCounters.value;
    viewCounters.value = emptyCounters();
    return summariseTiming(c, 30).deliveredFps;
  }, [viewCounters]);

  const lockBowler = useCallback(
    (id: number | null) => {
      engine.lockBowler(id);
      setBowlerId(id);
    },
    [engine],
  );

  return {
    model: plugin.state === 'loaded' ? ('ready' as const) : plugin.state === 'error' ? ('error' as const) : ('loading' as const),
    modelError: plugin.state === 'error' ? plugin.error.message : null,
    frameProcessor,
    people,
    bowlerId,
    status,
    upright,
    check,
    recheckOrientation: beginProbe,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    peekTiming,
    readLiveFps,
    lockBowler,
    diagnostics: { ...diag, modelPath: plugin.path },
  };
}
