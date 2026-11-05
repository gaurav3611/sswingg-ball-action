import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Screen } from '@/components/screen';
import { Button, Card, Choices, SectionTitle, Segmented, ToggleRow, Txt } from '@/components/ui';
import { FPS_CHOICES } from '@/capture/capabilities';
import { useApp } from '@/state/app';
import { space } from '@/theme/tokens';

const RETENTION = [
  { value: 'none', label: 'Until I delete' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
];

export default function Settings() {
  const app = useApp();
  const s = app.settings;
  const retention = s.retentionDays === null ? 'none' : String(s.retentionDays);

  const confirm = (title: string, message: string, action: string, run: () => Promise<void>) =>
    Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: action, style: 'destructive', onPress: run }]);

  return (
    <Screen title="Settings and privacy" back>
      <Card>
        <SectionTitle icon="camera">Camera</SectionTitle>
        <Segmented
          label="Default frame rate"
          value={s.defaultFps}
          onChange={(v) => app.updateSettings({ defaultFps: v })}
          options={FPS_CHOICES.map((f) => ({ value: f as number, label: String(f) }))}
        />
        <Txt variant="small" tone="muted">
          Only the rates your phone reports are offered when you start a session.
        </Txt>
        <ToggleRow label="Show the skeleton" detail="On the live camera and in the replay." value={s.showSkeleton} onChange={(v) => app.updateSettings({ showSkeleton: v })} />
        <Button
          label="Run the orientation check again"
          variant="secondary"
          onPress={() => app.updateSettings({ poseRotations: {} })}
        />
        <Txt variant="small" tone="muted">
          The app learns how your phone's camera is turned the first time you open it. Use this if the skeleton ever appears sideways.
        </Txt>
      </Card>

      <Card>
        <SectionTitle icon="lock">Privacy</SectionTitle>
        <Txt variant="body">Video and pose tracks are stored in this app only. Nothing is uploaded. You share a video by pressing Share on its session, one at a time.</Txt>
        <ToggleRow label="Cloud processing" detail="Not available in this version. There is no server." value={false} onChange={() => {}} disabled />
        <ToggleRow
          label="Allow sharing with a coach"
          detail="Saves your choice for when coach access exists. Nothing is shared now."
          value={s.coachSharingConsent}
          onChange={(v) => app.updateSettings({ coachSharingConsent: v })}
        />
        <Choices
          label="Delete sessions automatically after"
          value={retention}
          onChange={(v) => app.updateSettings({ retentionDays: v === 'none' ? null : Number(v) })}
          options={RETENTION}
        />
        <Txt variant="small" tone="muted">
          Applied when the app opens. Sessions older than this, with their video, are deleted.
        </Txt>
      </Card>

      <Card>
        <SectionTitle icon="download">Your data</SectionTitle>
        <Button
          label="Export my records"
          icon="download"
          variant="secondary"
          onPress={async () => {
            const ok = await app.exportData();
            if (!ok) Alert.alert('Sharing is not available', 'This phone has no way to share a file right now.');
          }}
        />
        <Txt variant="small" tone="muted">
          Exports your account, bowlers, settings and session details as one file. Video and pose tracks are not included.
        </Txt>
        <View style={{ gap: space.sm }}>
          <Button
            label="Delete all sessions"
            icon="trash"
            variant="danger"
            onPress={() =>
              confirm('Delete all sessions?', 'Every recording and pose track on this phone is deleted. Your account and bowlers stay.', 'Delete', async () => {
                for (const x of app.mySessions) await app.deleteSession(x.id);
              })
            }
          />
          <Button
            label="Delete everything and my account"
            icon="trash"
            variant="danger"
            onPress={() =>
              confirm('Delete everything?', 'Your account, bowlers, sessions and videos are deleted from this phone. This cannot be undone.', 'Delete everything', async () => {
                await app.deleteEverything();
                router.replace('/');
              })
            }
          />
        </View>
      </Card>

      <Card>
        <SectionTitle icon="info">About</SectionTitle>
        <Txt variant="small">SSwinGG Ball Action {Constants.expoConfig?.version}. Android.</Txt>
        <Txt variant="small" tone="muted">
          Pose model: MoveNet MultiPose Lightning, Google, Apache License 2.0. Icons: Lucide, ISC licence. Fonts: Inter and Source Serif 4, SIL Open Font License.
        </Txt>
        <Txt variant="small" tone="muted">
          This app gives technique indicators, not medical advice. It does not say whether a bowling action is legal.
        </Txt>
      </Card>
    </Screen>
  );
}
