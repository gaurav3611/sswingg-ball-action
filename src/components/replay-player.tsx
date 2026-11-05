import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { SkeletonOverlay } from './skeleton-overlay';
import { Button, Chip, IconButton, Txt } from './ui';
import { frameAt, type PoseTrack } from '@/data/poseFile';
import type { ClipRange, DeliveryMarker, Session } from '@/data/types';
import { fitRect } from '@/pose/geometry';
import type { PoseFrame } from '@/pose/types';
import { colors, radius, space } from '@/theme/tokens';

export const SPEEDS = [0.25, 0.5, 1] as const;

export const formatClock = (ms: number) => {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}.${String(Math.floor(total % 1000)).padStart(3, '0')}`;
};

/**
 * The seconds one frame lasts, for stepping. The video file's own rate is used when the player
 * reports it, then the rate that was delivered while recording, then the one that was asked for.
 */
export function frameSeconds(fileFps: number | null | undefined, delivered: number | null, requested: number): number {
  const fps = [fileFps, delivered, requested].find((f): f is number => typeof f === 'number' && f > 1 && f < 1000) ?? 30;
  return 1 / fps;
}

/** True when the video and the pose track have a different shape, so the skeleton would not line up. */
export function shapesDiffer(video: { width: number; height: number } | null | undefined, track: { width: number; height: number }): boolean {
  if (!video || video.width <= 0 || video.height <= 0) return false;
  const want = track.width / track.height;
  const direct = video.width / video.height;
  const swapped = video.height / video.width;
  const close = (a: number) => Math.abs(a - want) / want < 0.08;
  return !close(direct) && !close(swapped);
}

export function ReplayPlayer({
  session,
  track,
  showSkeleton,
  seekRequest,
  onTime,
  onFrame,
}: {
  session: Session;
  track: PoseTrack | null;
  showSkeleton: boolean;
  /** Ask the player to jump to a time. A new object each time makes a new jump. */
  seekRequest: { ms: number } | null;
  onTime: (ms: number) => void;
  onFrame: (frame: PoseFrame | null) => void;
}) {
  const player = useVideoPlayer(session.videoUri ?? '', (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.04;
  });
  const [ms, setMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [barWidth, setBarWidth] = useState(0);
  const durationMs = session.capture.durationMs;
  const offset = session.pose.syncOffsetMs;

  useEffect(() => {
    const t = player.addListener('timeUpdate', (e) => setMs(e.currentTime * 1000));
    const p = player.addListener('playingChange', (e) => setPlaying(e.isPlaying));
    return () => {
      t.remove();
      p.remove();
    };
  }, [player]);

  useEffect(() => {
    player.playbackRate = speed;
  }, [player, speed]);

  const seek = (toMs: number) => {
    const clamped = Math.min(Math.max(toMs, 0), durationMs);
    player.currentTime = clamped / 1000;
    setMs(clamped);
  };

  useEffect(() => {
    if (seekRequest) {
      player.pause();
      seek(seekRequest.ms);
    }
    // seek is stable enough: it only reads durationMs and player
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekRequest]);

  const frame = track ? frameAt(track, ms + offset) : null;
  useEffect(() => {
    onTime(ms);
    onFrame(frame);
    // frame is derived from ms and offset
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, offset, track]);

  const step = (dir: -1 | 1) => {
    player.pause();
    const dt = frameSeconds(player.videoTrack?.frameRate, session.capture.deliveredFps, session.capture.requestedFps) * 1000;
    seek(ms + dir * dt);
  };

  const scrub = (e: GestureResponderEvent) => {
    if (barWidth > 0) seek((e.nativeEvent.locationX / barWidth) * durationMs);
  };

  const trackShape = track ? { width: track.width, height: track.height } : null;
  const mismatch = trackShape ? shapesDiffer(player.videoTrack?.size, trackShape) : false;
  const rect = trackShape ? fitRect(box, trackShape.width / trackShape.height) : { x: 0, y: 0, width: 0, height: 0 };
  const pct = (t: number) => `${Math.min(100, Math.max(0, (t / Math.max(1, durationMs)) * 100))}%` as const;

  return (
    <View style={{ gap: space.md }}>
      <View style={styles.stage} onLayout={(e: LayoutChangeEvent) => setBox(e.nativeEvent.layout)}>
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
        {track && showSkeleton && !mismatch ? (
          <SkeletonOverlay people={frame?.people ?? []} bowlerId={frame?.bowlerId ?? null} rect={rect} />
        ) : null}
      </View>

      {mismatch ? (
        <Txt variant="small" tone="red" accessibilityRole="alert">
          The video and the pose track have different shapes, so the skeleton is hidden. This happens if the phone was turned while recording.
        </Txt>
      ) : null}
      {track && showSkeleton && !mismatch && !frame ? (
        <Txt variant="small" tone="muted">
          No pose was analysed near this moment.
        </Txt>
      ) : null}

      <View
        style={styles.bar}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onResponderGrant={scrub}
        onResponderMove={scrub}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Position ${formatClock(ms)} of ${formatClock(durationMs)}`}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => seek(ms + (e.nativeEvent.actionName === 'increment' ? 1000 : -1000))}
      >
        {session.clips.map((c: ClipRange) => (
          <View key={c.id} style={{ position: 'absolute', left: pct(c.startMs), width: pct(c.endMs - c.startMs), top: 0, bottom: 0, backgroundColor: colors.accentSoft }} />
        ))}
        <View style={{ position: 'absolute', left: 0, width: pct(ms), top: 0, bottom: 0, backgroundColor: colors.accent, opacity: 0.25 }} />
        {session.deliveries.map((d: DeliveryMarker) => (
          <View key={d.id} style={{ position: 'absolute', left: pct(d.tMs), top: 0, bottom: 0, width: 3, backgroundColor: colors.ochre }} />
        ))}
        <View style={{ position: 'absolute', left: pct(ms), top: -2, bottom: -2, width: 3, backgroundColor: colors.text }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Txt variant="small" style={{ fontVariant: ['tabular-nums'] }}>
          {formatClock(ms)}
        </Txt>
        <Txt variant="small" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
          {formatClock(durationMs)}
        </Txt>
      </View>

      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
        <IconButton icon="step-back" label="Back one frame" onPress={() => step(-1)} />
        <IconButton icon={playing ? 'pause' : 'play'} label={playing ? 'Pause' : 'Play'} onPress={() => (playing ? player.pause() : player.play())} />
        <IconButton icon="step-forward" label="Forward one frame" onPress={() => step(1)} />
        <View style={{ flex: 1 }} />
        {SPEEDS.map((s) => (
          <Button key={s} label={`${s}x`} variant={s === speed ? 'primary' : 'secondary'} onPress={() => setSpeed(s)} style={{ minWidth: 64, paddingHorizontal: space.sm }} accessibilityLabel={`Speed ${s} times`} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <Chip label={`One frame is ${(frameSeconds(player.videoTrack?.frameRate, session.capture.deliveredFps, session.capture.requestedFps) * 1000).toFixed(1)} ms`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { aspectRatio: 16 / 10, backgroundColor: colors.stage, borderRadius: radius.lg, overflow: 'hidden' },
  bar: { height: 28, backgroundColor: colors.surface2, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
});
