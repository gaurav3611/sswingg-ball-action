import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { useKeepAwake } from 'expo-keep-awake';
import { Camera, useCameraDevice, useCameraPermission, type VideoFile } from 'react-native-vision-camera';
import { Icon } from '@/components/icon';
import { SkeletonOverlay, visibleJoints } from '@/components/skeleton-overlay';
import { Button, Chip, EmptyState, ErrorState, IconButton, Loading, Txt } from '@/components/ui';
import { Screen } from '@/components/screen';
import { bestFormatFor } from '@/capture/capabilities';
import { MODEL_ID, usePoseCamera, type RecordingResult } from './usePoseCamera';
import { encodePoseTrack } from '@/data/poseFile';
import { parseSessionParams } from '@/data/sessionParams';
import { adoptVideo, writePoseText } from '@/data/storage';
import { formatDuration } from '@/data/summary';
import { DELIVERY_TYPES, type DeliveryMarker, type DeliveryType, type Session } from '@/data/types';
import { fitRect } from '@/pose/geometry';
import { coreConfidence } from '@/pose/status';
import { useApp } from '@/state/app';
import { colors, fonts, radius, space } from '@/theme/tokens';

type Phase = 'idle' | 'recording' | 'paused' | 'saving';

const stateTone = { tracking: 'good', 'low-confidence': 'estimate', lost: 'bad', 'left-frame': 'bad', searching: 'neutral' } as const;
const label = (d: string) => d.replace('-', ' ').replace(/^./, (c) => c.toUpperCase());

/** Chooses the delivery the bowler intends to bowl next. One tap, large targets, usable in sunlight. */
function IntendedPicker({ value, onChange }: { value: DeliveryType; onChange: (d: DeliveryType) => void }) {
  return (
    <View style={{ gap: 6 }}>
      <Txt variant="label" style={{ color: '#c9d3c4' }}>
        Intended delivery
      </Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} accessibilityRole="radiogroup">
        {DELIVERY_TYPES.map((d) => {
          const selected = d === value;
          return (
            <Pressable
              key={d}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={label(d)}
              onPress={() => onChange(d)}
              style={{
                minHeight: 44,
                paddingHorizontal: 14,
                borderRadius: radius.md,
                borderWidth: 1,
                justifyContent: 'center',
                borderColor: selected ? colors.green : '#3a4b3f',
                backgroundColor: selected ? colors.accent : '#1b2a20',
              }}
            >
              <Text style={{ color: '#ffffff', fontFamily: fonts.uiSemi, fontSize: 14 }}>{label(d)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function LiveScreen() {
  const app = useApp();
  const params = parseSessionParams(useLocalSearchParams());
  const bowler = app.activeBowler;
  const focused = useIsFocused();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const format = useMemo(() => (device ? bestFormatFor(device.formats, params.fps) : undefined), [device, params.fps]);
  const camera = useRef<Camera>(null);
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  useKeepAwake();

  const pose = usePoseCamera({
    requestedFps: params.fps,
    knownRotations: app.settings.poseRotations,
    onRotationLearned: (orientation, rotation) =>
      app.updateSettings({ poseRotations: { ...app.settings.poseRotations, [orientation]: rotation } }),
  });

  const [phase, setPhase] = useState<Phase>('idle');
  const [intended, setIntended] = useState<DeliveryType>(params.intended);
  const [markers, setMarkers] = useState<{ wallMs: number; intended: DeliveryType }[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [live, setLive] = useState<{ fps: number | null; dropped: number; below: boolean }>({ fps: null, dropped: 0, below: false });
  const [problem, setProblem] = useState<string | null>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  // Wall-clock timeline of the recording, minus time spent paused. Delivery marks use it.
  const wall = useRef({ start: 0, pausedAt: 0, pausedTotal: 0 });
  const result = useRef<RecordingResult | null>(null);
  const markersRef = useRef(markers);
  markersRef.current = markers;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const finishing = useRef(false);

  const recordingMs = useCallback(() => {
    const w = wall.current;
    const now = phaseRef.current === 'paused' ? w.pausedAt : Date.now();
    return Math.max(0, now - w.start - w.pausedTotal);
  }, []);

  useEffect(() => {
    if (phase !== 'recording' && phase !== 'paused') return;
    const id = setInterval(() => {
      setElapsedMs(recordingMs());
      const t = pose.peekTiming();
      setLive({ fps: t.deliveredFps, dropped: t.droppedEstimate, below: t.belowRequested });
    }, 500);
    return () => clearInterval(id);
  }, [phase, pose, recordingMs]);

  const finish = useCallback(
    async (video: VideoFile) => {
      if (finishing.current) return;
      finishing.current = true;
      try {
        const res = result.current;
        if (!bowler || !res) throw new Error('The recording ended before it was set up.');
        const id = Crypto.randomUUID();
        const durationMs = Math.round(video.duration * 1000);
        // The video file starts a little after the frame processor began counting.
        const syncOffsetMs = Math.max(0, Math.min(1500, Math.round(res.timing.seconds * 1000 - durationMs)));
        const videoUri = await adoptVideo(id, video.path);

        const haveTrack = res.frames.length > 0 && res.rotation !== null && res.upright !== null;
        let poseReason: string | null = null;
        if (!haveTrack) {
          poseReason =
            pose.model === 'error'
              ? `The pose model did not load: ${pose.modelError ?? 'unknown error'}.`
              : res.rotation === null
                ? 'The camera orientation was never confirmed, so no pose was recorded. Stand in view before recording.'
                : 'No one was found in the video.';
        } else {
          await writePoseText(
            id,
            encodePoseTrack({
              version: 1,
              modelId: MODEL_ID,
              width: res.upright!.width,
              height: res.upright!.height,
              rotation: res.rotation!,
              frames: res.frames,
            }),
          );
        }

        const deliveries: DeliveryMarker[] = markersRef.current.map((m) => ({
          id: Crypto.randomUUID(),
          tMs: Math.max(0, Math.round(m.wallMs - syncOffsetMs)),
          intended: m.intended,
          source: 'manual',
        }));

        const session: Session = {
          id,
          bowlerId: bowler.id,
          createdAt: new Date().toISOString(),
          sessionType: params.type,
          videoUri,
          capture: {
            requestedFps: params.fps,
            deliveredFps: res.timing.deliveredFps,
            droppedEstimate: res.timing.frames > 1 ? res.timing.droppedEstimate : null,
            longestGapMs: res.timing.frames > 1 ? Math.round(res.timing.longestGapMs) : null,
            belowRequested: res.timing.belowRequested,
            frames: res.timing.frames,
            widthPx: video.width,
            heightPx: video.height,
            durationMs,
            cameraView: params.view,
            formatMaxFps: format?.maxFps ?? params.fps,
            deviceModel: Device.modelName ?? 'unknown',
            osVersion: `${Device.osName ?? ''} ${Device.osVersion ?? ''}`.trim(),
            appVersion: Constants.expoConfig?.version ?? 'unknown',
            calibration: null,
          },
          pose: {
            status: haveTrack ? 'ok' : 'unavailable',
            reason: poseReason,
            modelId: MODEL_ID,
            frames: res.frames.length,
            analysedHz: res.frames.length > 1 ? res.frames.length / Math.max(0.001, (res.frames.at(-1)!.t - res.frames[0]!.t) / 1000) : null,
            rotation: res.rotation,
            bowlerCoverage: res.bowlerCoverage,
            syncOffsetMs,
          },
          deliveries,
          clips: [],
        };
        await app.addSession(session);
        router.replace(`/session/${id}`);
      } catch (e) {
        setProblem(e instanceof Error ? e.message : 'The recording could not be saved.');
        setPhase('idle');
      } finally {
        finishing.current = false;
      }
    },
    [app, bowler, format?.maxFps, params, pose.model, pose.modelError],
  );

  const start = useCallback(() => {
    if (!camera.current) return;
    setProblem(null);
    setMarkers([]);
    setElapsedMs(0);
    setLive({ fps: null, dropped: 0, below: false });
    wall.current = { start: Date.now(), pausedAt: 0, pausedTotal: 0 };
    result.current = null;
    pose.startRecording();
    setPhase('recording');
    camera.current.startRecording({
      fileType: 'mp4',
      videoCodec: 'h264',
      onRecordingFinished: (video) => {
        finish(video);
      },
      onRecordingError: (error) => {
        setProblem(`Recording stopped: ${error.message}`);
        setPhase('idle');
      },
    });
  }, [finish, pose]);

  const stop = useCallback(async () => {
    if (!camera.current || (phaseRef.current !== 'recording' && phaseRef.current !== 'paused')) return;
    result.current = pose.stopRecording();
    setPhase('saving');
    try {
      await camera.current.stopRecording();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'The recording could not be stopped.');
      setPhase('idle');
    }
  }, [pose]);

  const togglePause = useCallback(async () => {
    if (!camera.current) return;
    try {
      if (phaseRef.current === 'recording') {
        wall.current.pausedAt = Date.now();
        pose.pauseRecording();
        await camera.current.pauseRecording();
        setPhase('paused');
      } else if (phaseRef.current === 'paused') {
        wall.current.pausedTotal += Date.now() - wall.current.pausedAt;
        pose.resumeRecording();
        await camera.current.resumeRecording();
        setPhase('recording');
      }
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Pause did not work on this phone.');
    }
  }, [pose]);

  const mark = useCallback(() => {
    if (phaseRef.current !== 'recording') return;
    setMarkers((m) => [...m, { wallMs: recordingMs(), intended }]);
  }, [intended, recordingMs]);

  // A recording cannot go on in the background, so it is stopped and kept.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' && (phaseRef.current === 'recording' || phaseRef.current === 'paused')) stop();
    });
    return () => sub.remove();
  }, [stop]);

  const leave = () => {
    if (phase === 'recording' || phase === 'paused') {
      Alert.alert('Stop recording?', 'Leaving now stops the recording and keeps what has been filmed.', [
        { text: 'Keep recording', style: 'cancel' },
        { text: 'Stop and save', onPress: () => stop() },
      ]);
    } else router.back();
  };

  /* ------------------------------------------------------------- guards */
  if (!bowler) {
    return (
      <Screen title="Live camera" back>
        <EmptyState icon="user" title="No bowler chosen" detail="Choose a bowler before recording." />
      </Screen>
    );
  }
  if (!hasPermission) {
    const denied = Camera.getCameraPermissionStatus() === 'denied';
    return (
      <Screen title="Live camera" back>
        <ErrorState
          title="Camera access is off"
          detail="The camera is needed to record and to find the bowler. Video stays on this phone."
          action={
            denied ? (
              <Button label="Open phone settings" onPress={() => Linking.openSettings()} />
            ) : (
              <Button label="Allow camera access" onPress={() => requestPermission()} />
            )
          }
        />
      </Screen>
    );
  }
  if (!device || !format) {
    return (
      <Screen title="Live camera" back>
        <ErrorState
          title="This frame rate is not available"
          detail={`No camera mode on this phone records at ${params.fps} fps at a useful size. Go back and choose another rate.`}
          action={<Button label="Go back" variant="secondary" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  /* ------------------------------------------------------------- screen */
  const rect = pose.upright ? fitRect(box, pose.upright.width / pose.upright.height) : { x: 0, y: 0, width: 0, height: 0 };
  const bowlerPerson = pose.people.find((p) => p.trackId === pose.bowlerId);
  const recording = phase === 'recording' || phase === 'paused';

  const controls = (
    <View style={[styles.panel, landscape ? styles.panelSide : styles.panelBottom]}>
      {phase === 'idle' ? (
        <>
          <IntendedPicker value={intended} onChange={setIntended} />
          <Button label="Start recording" icon="video" variant="danger" onPress={start} disabled={pose.model === 'loading'} />
          {pose.model === 'loading' ? <Loading label="Loading the pose model" /> : null}
        </>
      ) : (
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                label={phase === 'paused' ? 'Resume' : 'Pause'}
                icon={phase === 'paused' ? 'play' : 'pause'}
                variant="secondary"
                onPress={togglePause}
                disabled={phase === 'saving'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Stop" icon="square" variant="danger" onPress={stop} loading={phase === 'saving'} />
            </View>
          </View>
          <Button
            label={`Mark delivery (${markers.length})`}
            icon="flag"
            onPress={mark}
            disabled={phase !== 'recording'}
            accessibilityLabel={`Mark a ${label(intended)} delivery. ${markers.length} marked so far.`}
          />
          <IntendedPicker value={intended} onChange={setIntended} />
        </View>
      )}
      {problem ? (
        <Txt variant="small" style={{ color: '#ffb4a8' }} accessibilityRole="alert">
          {problem}
        </Txt>
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.stage, landscape && { flexDirection: 'row' }]}>
        <View style={{ flex: 1 }} onLayout={(e: LayoutChangeEvent) => setBox(e.nativeEvent.layout)}>
          <Camera
            ref={camera}
            style={StyleSheet.absoluteFill}
            device={device}
            format={format}
            fps={params.fps}
            isActive={focused}
            video
            audio={false}
            frameProcessor={pose.frameProcessor}
            resizeMode="contain"
            outputOrientation="preview"
            videoStabilizationMode="off"
            onError={(e) => setProblem(`Camera error: ${e.message}`)}
          />
          {app.settings.showSkeleton ? (
            <SkeletonOverlay people={pose.people} bowlerId={pose.bowlerId} rect={rect} onSelect={pose.lockBowler} showLabels />
          ) : null}

          <View style={styles.hud} pointerEvents="box-none">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <IconButton icon="arrow-left" label="Leave the camera" tone="stage" onPress={leave} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  <Chip label={pose.status.message} tone={stateTone[pose.status.state]} />
                </View>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  <Chip
                    label={
                      recording && live.fps !== null
                        ? `${live.fps.toFixed(0)} fps delivered, ${params.fps} requested`
                        : `${params.fps} fps requested, camera max ${format.maxFps}`
                    }
                    tone={live.below ? 'bad' : 'neutral'}
                  />
                  {recording && live.dropped > 0 ? <Chip label={`About ${live.dropped} frames dropped`} tone={live.below ? 'bad' : 'estimate'} /> : null}
                  <Chip label={pose.model === 'ready' ? 'Pose model ready' : pose.model === 'loading' ? 'Loading pose model' : 'Pose model failed'} tone={pose.model === 'ready' ? 'good' : pose.model === 'error' ? 'bad' : 'neutral'} />
                  {bowlerPerson ? <Chip label={`${visibleJoints(bowlerPerson.keypoints)} of 17 joints, confidence ${coreConfidence(bowlerPerson).toFixed(2)}`} tone="neutral" /> : null}
                </View>
              </View>
            </View>
            {pose.check.state === 'checking' ? (
              <View style={styles.banner}>
                <Txt variant="small" style={{ color: '#fff' }}>
                  {pose.check.note}
                </Txt>
              </View>
            ) : null}
            {pose.model === 'error' ? (
              <View style={[styles.banner, { backgroundColor: colors.red }]}>
                <Txt variant="small" style={{ color: '#fff' }}>
                  The pose model could not load: {pose.modelError}. You can still record video. There will be no skeleton.
                </Txt>
              </View>
            ) : null}
            {recording ? (
              <View style={styles.recordingBar}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: phase === 'paused' ? colors.ochre : '#ff5a4a' }} />
                <Txt variant="heading" style={{ color: '#fff', fontVariant: ['tabular-nums'] }}>
                  {phase === 'paused' ? 'Paused' : 'Recording'} {formatDuration(elapsedMs)}
                </Txt>
                <Icon name="flag" size={16} color="#fff" />
                <Txt variant="heading" style={{ color: '#fff', fontVariant: ['tabular-nums'] }}>
                  {markers.length}
                </Txt>
              </View>
            ) : null}
          </View>
        </View>
        {controls}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.stage },
  stage: { flex: 1 },
  hud: { position: 'absolute', left: 0, right: 0, top: 0, padding: space.md, paddingTop: space.xl, gap: space.sm },
  banner: { backgroundColor: 'rgba(14,22,17,0.85)', borderRadius: radius.md, padding: space.md },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(14,22,17,0.85)',
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  panel: { backgroundColor: colors.stage, padding: space.lg, gap: space.md, borderColor: '#2a3a2f' },
  panelBottom: { borderTopWidth: 1 },
  panelSide: { width: 300, borderLeftWidth: 1, justifyContent: 'center' },
});
