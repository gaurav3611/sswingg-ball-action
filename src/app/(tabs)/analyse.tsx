import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Button, Card, Chip, SectionTitle, Txt } from '@/components/ui';
import { FEATURES, STATUS_LABEL } from '@/features';
import { useApp } from '@/state/app';
import { colors, space } from '@/theme/tokens';

const TOOLS = ['phases', 'biomechanics', 'runup', 'wrist', 'speed', 'coach'];
const tone = { working: 'good', experimental: 'estimate', planned: 'neutral' } as const;

export default function Analyse() {
  const app = useApp();
  return (
    <Screen title="Analyse">
      <Card>
        <SectionTitle icon="video">Record</SectionTitle>
        <Txt variant="body">
          {app.activeBowler
            ? `Bowler: ${app.activeBowler.name}. Choose the session type, camera view and frame rate next.`
            : 'Add a bowler profile before recording.'}
        </Txt>
        <Button
          label={app.activeBowler ? 'Start new session' : 'Add a bowler'}
          icon="play"
          onPress={() => router.push(app.activeBowler ? '/session/new' : '/bowler/edit')}
        />
      </Card>

      <Card>
        <SectionTitle icon="activity">Analysis tools</SectionTitle>
        <Txt variant="small" tone="muted">
          Tools that are not built yet say so. None of them show sample numbers.
        </Txt>
        {TOOLS.map((id) => {
          const f = FEATURES.find((x) => x.id === id)!;
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`${f.title}. ${STATUS_LABEL[f.status]}, phase ${f.phase}`}
              onPress={() => router.push(`/feature/${id}`)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                minHeight: 56,
                paddingVertical: space.sm,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                backgroundColor: pressed ? colors.surface2 : 'transparent',
              })}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Txt variant="body" style={{ fontFamily: 'Inter_500Medium' }}>
                  {f.title}
                </Txt>
                <Chip label={`${STATUS_LABEL[f.status]}, phase ${f.phase}`} tone={tone[f.status]} />
              </View>
              <Icon name="chevron-right" size={20} color={colors.muted} />
            </Pressable>
          );
        })}
      </Card>
    </Screen>
  );
}
