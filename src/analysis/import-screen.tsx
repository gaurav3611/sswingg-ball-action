import { useRef, useState } from 'react';
import { View } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { Screen } from '@/components/screen';
import { Button, Card, Choices, EmptyState, ErrorState, Loading, SectionTitle, Segmented, Txt } from '@/components/ui';
import { analyseFrames } from './analyseFrames';
import { openFrameSource, runModel, type FrameSource } from './nativeFrames';
import { frameTimes } from './pixels';
import { MODEL_ID, MODEL_SOURCE } from '@/camera/modelSource';
import { useModel } from '@/camera/useModel';
import { encodePoseTrack } from '@/data/poseFile';
import { adoptVideo, writePoseText } from '@/data/storage';
import { formatDuration } from '@/data/summary';
import type { Session } from '@/data/types';
import { displayArm } from '@/data/validation';
import type { CameraView } from '@/pose/types';
import { useApp } from '@/state/app';
import { colors, radius, space } from '@/theme/tokens';

/** Frames read per second of video. The same rate the camera screen analyses at while recording. */
const ANALYSE_HZ = 10;
/** Longest stretch analysed, in ms. Longer videos are analysed from the start. */
const MAX_MS = 60_000;

type Picked = { uri: string; durationMs: number; width: number; height: number; name: string; bytes: number | null };
type Phase = { kind: 'choose' } | { kind: 'working'; done: number; total: number } | { kind: 'failed'; message: string };

export function ImportScreen() {
  const app = useApp();
  const bowler = app.activeBowler;
  const plugin = useModel(MODEL_SOURCE, true);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [view, setView] = useState<CameraView>(bowler?.preferredView ?? 'side');
  const [phase, setPhase] = useState<Phase>({ kind: 'choose' });
  const cancelled = useRef(false);
  const source = useRef<FrameSource | null>(null);
  useKeepAwake();

  if (!bowler) {
    return (
      <Screen title="Analyse a video" back>
        <EmptyState icon="user" title="Choose a bowler first" detail="The analysis needs the bowling arm of the bowler." action={<Button label="Add a bowler" onPress={() => router.replace('/bowler/edit')} />} />
      </Screen>
    );
  }

  async function choose() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: false, quality: 1 });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    setPicked({ uri: a.uri, durationMs: Math.round(a.duration ?? 0), width: a.width, height: a.height, name: a.fileName ?? 'Video', bytes: a.fileSize ?? null });
  }

  async function analyse() {
    if (!picked || plugin.state !== 'loaded' || !bowler) return;
    cancelled.current = false;
    const model = plugin.model;
    try {
      const times = frameTimes(picked.durationMs, ANALYSE_HZ, MAX_MS);
      if (times.length === 0) throw new Error('This video has no length that the phone could read.');
      setPhase({ kind: 'working', done: 0, total: times.length });
      source.current = await openFrameSource(picked.uri);
      const result = await analyseFrames({
        timesMs: times,
        extract: (ms) => source.current!.frameAt(ms),
        infer: (rgb) => runModel(model, rgb),
        onProgress: (done, total) => setPhase({ kind: 'working', done, total }),
        isCancelled: () => cancelled.current,
      });
      source.current?.close();
      source.current = null;
      if (!result) {
        setPhase({ kind: 'choose' });
        return;
      }
      if (result.analysed === 0 || !result.size) {
        throw new Error(result.firstError ?? 'No frame could be read from this video.');
      }

      const id = Crypto.randomUUID();
      const videoUri = await adoptVideo(id, picked.uri);
      const analysedMs = Math.min(picked.durationMs, MAX_MS);
      if (result.frames.length > 0) {
        await writePoseText(
          id,
          encodePoseTrack({ version: 1, modelId: MODEL_ID, width: result.size.width, height: result.size.height, rotation: 0, frames: result.frames }),
        );
      }
      const session: Session = {
        id,
        bowlerId: bowler.id,
        createdAt: new Date().toISOString(),
        sessionType: 'nets',
        videoUri,
        capture: {
          source: 'imported',
          requestedFps: 0,
          deliveredFps: null,
          droppedEstimate: null,
          longestGapMs: null,
          belowRequested: false,
          frames: 0,
          widthPx: picked.width,
          heightPx: picked.height,
          durationMs: picked.durationMs,
          cameraView: view,
          formatMaxFps: 0,
          deviceModel: 'Imported video',
          osVersion: '',
          appVersion: '',
          calibration: null,
        },
        pose: {
          status: result.frames.length > 0 ? 'ok' : 'unavailable',
          reason: result.frames.length > 0 ? null : 'No one was found in the video.',
          modelId: MODEL_ID,
          frames: result.frames.length,
          analysedHz: result.frames.length > 1 ? result.frames.length / Math.max(0.001, analysedMs / 1000) : null,
          rotation: 0,
          bowlerCoverage: result.bowlerCoverage,
          // Pose times are video times, read frame by frame from the file: nothing to line up.
          syncOffsetMs: 0,
        },
        deliveries: [],
        clips: [],
      };
      await app.addSession(session);
      router.replace(`/session/${id}`);
    } catch (e) {
      source.current?.close();
      source.current = null;
      setPhase({ kind: 'failed', message: e instanceof Error ? e.message : String(e) });
    }
  }

  const modelState = plugin.state;
  const working = phase.kind === 'working';

  if (phase.kind === 'failed') {
    return (
      <Screen title="Analyse a video" back>
        <ErrorState
          title="The video could not be analysed"
          detail={phase.message}
          action={<Button label="Try again" variant="secondary" onPress={() => setPhase({ kind: 'choose' })} />}
        />
      </Screen>
    );
  }

  return (
    <Screen title="Analyse a video" subtitle={`${bowler.name}, ${displayArm(bowler).toLowerCase()}`} back={working ? undefined : true}>
      <Card>
        <SectionTitle icon="video">Video</SectionTitle>
        {picked ? (
          <>
            <Txt variant="body" style={{ fontFamily: 'Inter_600SemiBold' }}>
              {picked.name}
            </Txt>
            <Txt variant="small" tone="muted">
              {formatDuration(picked.durationMs)} long, {picked.width} by {picked.height} px{picked.bytes ? `, ${(picked.bytes / 1e6).toFixed(1)} MB` : ''}
            </Txt>
            {picked.durationMs > MAX_MS ? (
              <Txt variant="small" tone="red">
                Only the first {MAX_MS / 1000} seconds are analysed.
              </Txt>
            ) : null}
          </>
        ) : (
          <Txt variant="body" tone="muted">
            Choose a video of a bowler that is stored on this phone. It is copied into the app and nothing is uploaded.
          </Txt>
        )}
        <Button label={picked ? 'Choose another video' : 'Choose a video'} icon="video" variant="secondary" onPress={choose} disabled={working} />
      </Card>

      <Card>
        <Segmented
          label="Where was the camera?"
          value={view}
          onChange={setView}
          options={[
            { value: 'side', label: 'Side' },
            { value: 'front', label: 'Front' },
            { value: 'rear', label: 'Rear' },
          ]}
        />
        <Txt variant="small" tone="muted">
          This decides which angles can be read. Side-on to the pitch is best for arm and leg angles.
        </Txt>
      </Card>

      <Card>
        <SectionTitle icon="info">How it works</SectionTitle>
        <Txt variant="small" tone="muted">
          The app reads {ANALYSE_HZ} frames for every second of video, finds the people in each, follows the bowler, and saves a skeleton you can replay frame by frame. It takes roughly twice as long as the video. Keep the app open. Everything stays on this phone.
        </Txt>
        {modelState === 'loading' ? <Loading label="Loading the pose model" /> : null}
        {modelState === 'error' ? (
          <Txt variant="small" tone="red" accessibilityRole="alert">
            The pose model did not load: {plugin.error.message.split('\n')[0]}
          </Txt>
        ) : null}
      </Card>

      {working ? (
        <Card>
          <Txt variant="heading">
            Analysing frame {phase.done} of {phase.total}
          </Txt>
          <View style={{ height: 10, backgroundColor: colors.surface2, borderRadius: radius.sm }} accessible accessibilityLabel={`${Math.round((phase.done / Math.max(1, phase.total)) * 100)} percent done`}>
            <View style={{ height: 10, width: `${(phase.done / Math.max(1, phase.total)) * 100}%`, backgroundColor: colors.accent, borderRadius: radius.sm }} />
          </View>
          <Button
            label="Cancel"
            variant="secondary"
            onPress={() => {
              cancelled.current = true;
            }}
          />
        </Card>
      ) : (
        <Button label="Analyse this video" icon="play" onPress={analyse} disabled={!picked || modelState !== 'loaded'} />
      )}
    </Screen>
  );
}
