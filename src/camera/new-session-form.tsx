import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useCameraDevice } from 'react-native-vision-camera';
import { Screen } from '@/components/screen';
import { Button, Card, Choices, EmptyState, Segmented, Txt } from '@/components/ui';
import { FPS_CHOICES, supportedFps, whyNotOffered } from '@/capture/capabilities';
import { clampFps } from '@/data/sessionParams';
import { DELIVERY_TYPES, type DeliveryType, type SessionType } from '@/data/types';
import { displayArm } from '@/data/validation';
import type { CameraView } from '@/pose/types';
import { useApp } from '@/state/app';
import { space } from '@/theme/tokens';

const label = (d: string) => d.replace('-', ' ').replace(/^./, (c) => c.toUpperCase());

export function NewSessionForm() {
  const app = useApp();
  const bowler = app.activeBowler;
  const device = useCameraDevice('back');
  const offered = device ? supportedFps(device.formats) : [];

  const [type, setType] = useState<SessionType>('nets');
  const [view, setView] = useState<CameraView>(bowler?.preferredView ?? 'side');
  const [fpsChoice, setFps] = useState<number>(app.settings.defaultFps);
  const [intended, setIntended] = useState<DeliveryType>('stock');
  const fps = clampFps(fpsChoice, offered);

  if (!bowler) {
    return (
      <Screen title="New session" back>
        <EmptyState icon="user" title="Choose a bowler first" detail="A session is recorded for one bowler." action={<Button label="Add a bowler" onPress={() => router.replace('/bowler/edit')} />} />
      </Screen>
    );
  }
  if (!device) {
    return (
      <Screen title="New session" back>
        <EmptyState icon="video" title="No camera found" detail="This phone did not report a back camera, so a session cannot be recorded." />
      </Screen>
    );
  }

  return (
    <Screen title="New session" back>
      <Card>
        {app.myBowlers.length > 1 ? (
          <Choices
            label="Bowler"
            value={bowler.id}
            onChange={(id) => app.setActiveBowler(id)}
            options={app.myBowlers.map((b) => ({ value: b.id, label: b.name }))}
          />
        ) : (
          <View style={{ gap: 2 }}>
            <Txt variant="small" style={{ fontFamily: 'Inter_600SemiBold' }}>
              Bowler
            </Txt>
            <Txt variant="body">
              {bowler.name}, {displayArm(bowler).toLowerCase()}, {bowler.style}
            </Txt>
          </View>
        )}
        <Segmented
          label="Session type"
          value={type}
          onChange={setType}
          options={[
            { value: 'nets', label: 'Nets' },
            { value: 'target', label: 'Target' },
            { value: 'drill', label: 'Drill' },
          ]}
        />
        <Segmented
          label="Camera view"
          value={view}
          onChange={setView}
          options={[
            { value: 'side', label: 'Side' },
            { value: 'front', label: 'Front' },
            { value: 'rear', label: 'Rear' },
          ]}
        />
      </Card>

      <Card>
        <Segmented
          label="Frame rate (frames per second)"
          value={fps}
          onChange={setFps}
          options={FPS_CHOICES.map((f) => ({ value: f as number, label: String(f) }))}
          disabledValues={FPS_CHOICES.filter((f) => !offered.includes(f)) as number[]}
        />
        <Txt variant="small" tone="muted">
          {offered.length > 0 ? `This phone reports video modes at ${offered.join(', ')} fps.` : 'This phone reports no usable video mode.'}{' '}
          {FPS_CHOICES.filter((f) => !offered.includes(f))
            .map((f) => `${f}: ${whyNotOffered(f)}`)
            .slice(0, 1)
            .join(' ')}
        </Txt>
        <Txt variant="small" tone="muted">
          What the phone reports is what the camera can do. After each recording the app shows the rate that actually arrived, and says if it was lower. Ball speed needs 120 fps or faster, and is not measured in this version.
        </Txt>
      </Card>

      <Card>
        <Choices label="Intended delivery" value={intended} onChange={setIntended} options={DELIVERY_TYPES.map((d) => ({ value: d, label: label(d) }))} />
        <Txt variant="small" tone="muted">
          This is what you plan to bowl. It is stored with each delivery you mark. The app cannot see what the ball actually did yet, so it does not compare the two.
        </Txt>
      </Card>

      <Button
        label="Continue to camera setup"
        icon="arrow-right"
        disabled={offered.length === 0}
        onPress={() => router.push({ pathname: '/session/setup', params: { type, view, fps: String(fps), intended } })}
      />
    </Screen>
  );
}
