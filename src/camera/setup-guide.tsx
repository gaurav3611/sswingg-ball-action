import { Linking, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, useCameraPermission } from 'react-native-vision-camera';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Button, Card, Chip, SectionTitle, Txt } from '@/components/ui';
import { METRIC_IDS, METRIC_INFO } from '@/biomechanics/angles';
import { parseSessionParams } from '@/data/sessionParams';
import { colors, space } from '@/theme/tokens';

const PLACEMENT = {
  side: 'Place the phone side-on to the pitch, level with the bowler\'s chest or hips, so the whole run-up, the delivery stride and the follow-through stay inside the picture.',
  front: 'Place the phone behind the bowler\'s target end, looking back at the bowler, at about chest height, so the bowler stays in frame from run-up to follow-through.',
  rear: 'Place the phone behind the bowler\'s start, looking down the pitch, at about chest height, so the run-up, the feet and the follow-through stay in frame.',
} as const;

export function SetupGuide() {
  const params = parseSessionParams(useLocalSearchParams());
  const { hasPermission, requestPermission } = useCameraPermission();
  const denied = !hasPermission && Camera.getCameraPermissionStatus() === 'denied';
  const supported = METRIC_IDS.filter((id) => METRIC_INFO[id].views.includes(params.view));
  const notSupported = METRIC_IDS.filter((id) => !METRIC_INFO[id].views.includes(params.view));

  const steps: [string, string][] = [
    ['Put the phone on a stable tripod.', 'Hand-held or moving video makes the joints jump and the angles unreliable.'],
    ['Keep the phone in one orientation.', 'Do not turn it while recording. The skeleton is drawn for the shape of the picture when recording started.'],
    ['Show the complete bowling area.', PLACEMENT[params.view]],
    ['Make sure the bowler is visible.', 'Plain, well lit clothing that contrasts with the background works best. Whole body, head to feet.'],
    ['Distance marker (not used yet).', 'Placing a marker of known length on the pitch will let a later version measure distance and speed. This version does not use it.'],
    ['Run the tracking test.', 'The next screen checks the camera orientation and finds the bowler. Stand in view until it says it is ready.'],
  ];

  return (
    <Screen title="Camera setup" subtitle={`${params.view[0]!.toUpperCase()}${params.view.slice(1)} view, ${params.fps} fps`} back>
      <Card>
        <SectionTitle icon="camera">Placing the phone</SectionTitle>
        {steps.map(([title, detail], i) => (
          <View key={title} style={{ flexDirection: 'row', gap: space.md }}>
            <View style={{ width: 28, height: 28, borderRadius: 4, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Txt variant="small" tone="accent" style={{ fontFamily: 'Inter_700Bold' }}>
                {i + 1}
              </Txt>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="body" style={{ fontFamily: 'Inter_600SemiBold' }}>
                {title}
              </Txt>
              <Txt variant="small" tone="muted">
                {detail}
              </Txt>
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <SectionTitle icon="eye">What this view can show</SectionTitle>
        <Txt variant="small" tone="muted">
          Each angle is an estimate from one flat picture. These can be read from the {params.view} view:
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {supported.map((id) => (
            <Chip key={id} label={METRIC_INFO[id].label} tone="estimate" />
          ))}
        </View>
        {notSupported.length > 0 ? (
          <>
            <Txt variant="small" tone="muted">
              Not readable from this view:
            </Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {notSupported.map((id) => (
                <Chip key={id} label={METRIC_INFO[id].label} tone="neutral" />
              ))}
            </View>
          </>
        ) : null}
      </Card>

      <Card>
        <SectionTitle icon="lock">Camera permission</SectionTitle>
        {hasPermission ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Icon name="circle-check" size={20} color={colors.green} />
            <Txt variant="body">Camera access is allowed.</Txt>
          </View>
        ) : (
          <>
            <Txt variant="body">
              The camera is used to record your session and to find the bowler. Video stays on this phone. The microphone is not used.
            </Txt>
            {denied ? (
              <>
                <Txt variant="small" tone="red" accessibilityRole="alert">
                  Camera access was turned off. Allow it in the phone settings to continue.
                </Txt>
                <Button label="Open phone settings" variant="secondary" onPress={() => Linking.openSettings()} />
              </>
            ) : (
              <Button label="Allow camera access" onPress={() => requestPermission()} />
            )}
          </>
        )}
      </Card>

      <Button
        label="Open the camera"
        icon="video"
        disabled={!hasPermission}
        onPress={() => router.push({ pathname: '/session/live', params: { type: params.type, view: params.view, fps: String(params.fps), intended: params.intended } })}
      />
    </Screen>
  );
}
