import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Icon } from '@/components/icon';
import { AngleChart } from '@/components/angle-chart';
import { MetricRow } from '@/components/measurement';
import { ReplayPlayer, formatClock } from '@/components/replay-player';
import { Screen } from '@/components/screen';
import { Button, Card, Chip, EmptyState, ErrorState, Loading, SectionTitle, Stat, ToggleRow, Txt } from '@/components/ui';
import { METRIC_IDS, METRIC_INFO, computeAngles, type MetricId } from '@/biomechanics/angles';
import { angleSeries, coverage } from '@/biomechanics/series';
import { decodePoseTrack, type PoseTrack } from '@/data/poseFile';
import { readPoseText } from '@/data/storage';
import { formatDate, formatDuration } from '@/data/summary';
import type { Session } from '@/data/types';
import type { PoseFrame } from '@/pose/types';
import { useApp } from '@/state/app';
import { colors, space } from '@/theme/tokens';

const label = (d: string) => d.replace('-', ' ').replace(/^./, (c) => c.toUpperCase());

export default function SessionScreen() {
  const app = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = app.sessions.find((s) => s.id === id);
  const bowler = session ? app.bowlers.find((b) => b.id === session.bowlerId) : undefined;

  const [track, setTrack] = useState<PoseTrack | null | undefined>(undefined);
  const [ms, setMs] = useState(0);
  const [frame, setFrame] = useState<PoseFrame | null>(null);
  const [seek, setSeek] = useState<{ ms: number } | null>(null);
  const [inMs, setInMs] = useState<number | null>(null);
  const [chartMetric, setChartMetric] = useState<MetricId>('elbow_bowling');

  useEffect(() => {
    let live = true;
    if (!session || session.pose.status !== 'ok') {
      setTrack(null);
      return;
    }
    readPoseText(session.id).then((text) => live && setTrack(text ? decodePoseTrack(text) : null));
    return () => {
      live = false;
    };
  }, [session?.id, session?.pose.status]);

  const series = useMemo(
    () => (track && session && bowler ? angleSeries(track, chartMetric, session.capture.cameraView, bowler.bowlingArm) : []),
    [track, session, bowler, chartMetric],
  );

  if (!session) {
    return (
      <Screen title="Session" back>
        <ErrorState title="Session not found" detail="It may have been deleted." action={<Button label="Go home" variant="secondary" onPress={() => router.replace('/')} />} />
      </Screen>
    );
  }

  const c = session.capture;
  const bowlerPerson = frame?.bowlerId != null ? frame.people.find((p) => p.trackId === frame.bowlerId) : undefined;
  const angles =
    track && bowlerPerson && bowler
      ? computeAngles(bowlerPerson.keypoints, { frame: { width: track.width, height: track.height }, view: c.cameraView, bowlingArm: bowler.bowlingArm })
      : null;

  async function shareVideo() {
    if (!session?.videoUri) return;
    Alert.alert(
      'Share this video?',
      'The video leaves this app and goes to the app you pick next. SSwinGG cannot take it back from there.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose app',
          onPress: async () => {
            if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(session.videoUri!, { mimeType: 'video/mp4' });
          },
        },
      ],
    );
  }

  function remove(retake: boolean) {
    Alert.alert(
      retake ? 'Retake this session?' : 'Delete this session?',
      'The video and the pose track are deleted from this phone. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: retake ? 'Delete and retake' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            await app.deleteSession(session!.id);
            if (retake) {
              router.replace({
                pathname: '/session/live',
                params: { type: session!.sessionType, view: c.cameraView, fps: String(c.requestedFps), intended: session!.deliveries.at(-1)?.intended ?? 'stock' },
              });
            } else router.replace('/');
          },
        },
      ],
    );
  }

  async function saveClip(endMs: number) {
    if (inMs === null) return;
    const [a, b] = inMs <= endMs ? [inMs, endMs] : [endMs, inMs];
    await app.updateSession(session!.id, { clips: [...session!.clips, { id: String(Date.now()), startMs: Math.round(a), endMs: Math.round(b), label: `Clip ${session!.clips.length + 1}` }] });
    setInMs(null);
  }

  const nudge = (d: number) => app.updateSession(session.id, { pose: { ...session.pose, syncOffsetMs: Math.max(-2000, Math.min(2000, session.pose.syncOffsetMs + d)) } });

  return (
    <Screen title={formatDate(session.createdAt)} subtitle={bowler ? `${bowler.name}, ${c.cameraView} view` : undefined} back={() => router.back()}>
      {!session.videoUri || Platform.OS === 'web' ? (
        <ErrorState title="No video to play" detail="This session has no video file on this device." />
      ) : (
        <Card>
          <SectionTitle icon="video">Replay</SectionTitle>
          <ReplayPlayer session={session} track={track ?? null} showSkeleton={app.settings.showSkeleton} seekRequest={seek} onTime={setMs} onFrame={setFrame} />
          <ToggleRow label="Show skeleton" value={app.settings.showSkeleton} onChange={(v) => app.updateSettings({ showSkeleton: v })} disabled={!track} />
          {session.pose.status === 'unavailable' ? (
            <Txt variant="small" tone="red" accessibilityRole="alert">
              No skeleton for this session. {session.pose.reason}
            </Txt>
          ) : track === undefined ? (
            <Loading label="Loading the pose track" />
          ) : null}
        </Card>
      )}

      {track ? (
        <Card>
          <SectionTitle icon="activity">{`Joint angles at ${formatClock(ms)}`}</SectionTitle>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Chip label="Experimental" tone="estimate" />
            <Chip label="Estimated from one 2D view" tone="neutral" />
          </View>
          <Txt variant="small" tone="muted">
            Each angle is the angle as it appears in the picture. A joint that bends towards or away from the camera looks straighter than it is. Nothing here has been checked against a reference measurement yet.
          </Txt>
          {!bowlerPerson ? (
            <Txt variant="body" tone="muted">
              The bowler was not followed at this moment, so there are no angles to show.
            </Txt>
          ) : (
            METRIC_IDS.map((mid) => <MetricRow key={mid} label={METRIC_INFO[mid].label} m={angles![mid]} meaning={METRIC_INFO[mid].meaning} />)
          )}
        </Card>
      ) : null}

      {track ? (
        <Card>
          <SectionTitle icon="chart-line">{`${METRIC_INFO[chartMetric].label} over the recording`}</SectionTitle>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {(['elbow_bowling', 'shoulder_elevation_bowling', 'knee_left', 'knee_right', 'trunk_tilt'] as MetricId[]).map((m) => (
              <Pressable key={m} accessibilityRole="radio" accessibilityState={{ selected: m === chartMetric }} onPress={() => setChartMetric(m)}>
                <Chip label={METRIC_INFO[m].label} tone={m === chartMetric ? 'accent' : 'neutral'} />
              </Pressable>
            ))}
          </View>
          <AngleChart points={series} currentMs={ms + session.pose.syncOffsetMs} durationMs={Math.max(c.durationMs + session.pose.syncOffsetMs, 1)} label={METRIC_INFO[chartMetric].label} />
          <Txt variant="small" tone="muted">
            A reading exists in {Math.round(coverage(series) * 100)}% of the analysed frames. Gaps in the line are moments with no reading.
          </Txt>
        </Card>
      ) : null}

      <Card>
        <SectionTitle icon="flag">Deliveries marked</SectionTitle>
        {session.deliveries.length === 0 ? (
          <EmptyState icon="flag" title="None marked" detail="Tap Mark delivery while recording to add one. Detecting deliveries automatically is Phase 3." />
        ) : (
          session.deliveries.map((d, i) => (
            <Pressable
              key={d.id}
              accessibilityRole="button"
              accessibilityLabel={`Delivery ${i + 1}, ${label(d.intended)}, at ${formatClock(d.tMs)}. Jump to it.`}
              onPress={() => setSeek({ ms: Math.max(0, d.tMs - 1500) })}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: pressed ? colors.surface2 : 'transparent' })}
            >
              <Txt variant="figure" style={{ fontSize: 20, width: 32 }}>
                {i + 1}
              </Txt>
              <View style={{ flex: 1 }}>
                <Txt variant="body" style={{ fontFamily: 'Inter_500Medium' }}>
                  Intended: {label(d.intended)}
                </Txt>
                <Txt variant="small" tone="muted">
                  At {formatClock(d.tMs)}. Marked by hand. Speed and actual delivery not measured.
                </Txt>
              </View>
              <Icon name="chevron-right" size={18} color={colors.muted} />
            </Pressable>
          ))
        )}
      </Card>

      <Card>
        <SectionTitle icon="scissors">Clip ranges</SectionTitle>
        <Txt variant="small" tone="muted">
          A clip range marks part of the recording. It is saved as a start and end time. The video file is not cut.
        </Txt>
        {session.clips.map((cl) => (
          <Pressable key={cl.id} accessibilityRole="button" onPress={() => setSeek({ ms: cl.startMs })} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Txt variant="body">
              {cl.label}: {formatClock(cl.startMs)} to {formatClock(cl.endMs)}
            </Txt>
          </Pressable>
        ))}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button label={inMs === null ? 'Start clip here' : `Start ${formatClock(inMs)}`} variant="secondary" onPress={() => setInMs(ms)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="End clip here" variant="secondary" disabled={inMs === null} onPress={() => saveClip(ms)} />
          </View>
        </View>
      </Card>

      <Card>
        <SectionTitle icon="gauge">How this was recorded</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg }}>
          <Stat value={String(c.requestedFps)} unit="fps" caption="Requested" />
          <Stat value={c.deliveredFps === null ? '--' : c.deliveredFps.toFixed(1)} unit="fps" caption="Delivered (counted)" />
          <Stat value={String(c.formatMaxFps)} unit="fps" caption="Camera mode maximum" />
        </View>
        {c.belowRequested ? (
          <Txt variant="small" tone="red" accessibilityRole="alert">
            The phone delivered fewer frames than requested. Slow motion and frame steps use the rate that actually arrived.
          </Txt>
        ) : null}
        <FactRow k="Resolution" v={`${c.widthPx} by ${c.heightPx} px`} kind="Measured" />
        <FactRow k="Duration" v={formatDuration(c.durationMs)} kind="Measured" />
        <FactRow k="Frames counted" v={String(c.frames)} kind="Measured" />
        <FactRow k="Frames dropped" v={c.droppedEstimate === null ? 'Not known' : `About ${c.droppedEstimate}`} kind="Estimated" />
        <FactRow k="Longest gap between frames" v={c.longestGapMs === null ? 'Not known' : `${c.longestGapMs} ms`} kind="Measured" />
        <FactRow k="Camera view" v={label(c.cameraView)} kind="Set by you" />
        <FactRow k="Distance calibration" v="None. Distances and speeds are not measured." kind="Unavailable" />
        <FactRow
          k="Pose model"
          v={session.pose.status === 'ok' ? `${session.pose.modelId}, about ${session.pose.analysedHz?.toFixed(1) ?? '?'} analysed frames per second, ${session.pose.frames} frames` : 'No pose track'}
          kind={session.pose.status === 'ok' ? 'Estimated' : 'Unavailable'}
        />
        <FactRow k="Bowler followed" v={session.pose.bowlerCoverage === null ? '--' : `${Math.round(session.pose.bowlerCoverage * 100)}% of analysed frames`} kind="Measured" />
        <FactRow k="Overlay timing offset" v={`${session.pose.syncOffsetMs} ms`} kind="Estimated" />
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <Txt variant="small" tone="muted" style={{ flex: 1 }}>
            If the skeleton leads or lags the body, nudge it.
          </Txt>
          <Button label="-50 ms" variant="secondary" onPress={() => nudge(-50)} style={{ minWidth: 80 }} />
          <Button label="+50 ms" variant="secondary" onPress={() => nudge(50)} style={{ minWidth: 80 }} />
        </View>
        <FactRow k="Device" v={`${c.deviceModel}, ${c.osVersion}`} kind="Measured" />
        <FactRow k="App version" v={c.appVersion} kind="Measured" />
      </Card>

      <View style={{ gap: space.sm }}>
        <Button label="Share this video" icon="download" variant="secondary" onPress={shareVideo} disabled={!session.videoUri} />
        <Button label="Retake" icon="rotate-ccw" variant="secondary" onPress={() => remove(true)} />
        <Button label="Delete this session" icon="trash" variant="danger" onPress={() => remove(false)} />
      </View>
    </Screen>
  );
}

function FactRow({ k, v, kind }: { k: string; v: string; kind: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="small" tone="muted">
          {k}
        </Txt>
        <Txt variant="body">{v}</Txt>
      </View>
      <Chip label={kind} tone={kind === 'Measured' ? 'accent' : kind === 'Estimated' ? 'estimate' : kind === 'Set by you' ? 'manual' : 'neutral'} />
    </View>
  );
}
