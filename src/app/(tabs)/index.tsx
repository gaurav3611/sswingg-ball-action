import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { SessionRow } from '@/components/session-row';
import { Button, Card, EmptyState, SectionTitle, Stat, Txt } from '@/components/ui';
import { todaySummary } from '@/data/summary';
import { useApp } from '@/state/app';
import { colors, radius, space } from '@/theme/tokens';

export default function Home() {
  const app = useApp();
  const today = todaySummary(app.mySessions, new Date());
  const recent = app.mySessions.slice(0, 5);
  const first = app.account?.name.split(' ')[0] ?? '';

  return (
    <Screen
      brand
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profile and settings"
          onPress={() => router.push('/profile')}
          style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="user" size={22} color={colors.text} />
        </Pressable>
      }
    >
      <View style={{ gap: 2 }}>
        <Txt variant="title">Hello, {first}</Txt>
        <Txt variant="body" tone="muted">
          {app.activeBowler ? `Ready to film ${app.activeBowler.name}'s next session.` : 'Add a bowler profile to start.'}
        </Txt>
      </View>

      <View style={{ backgroundColor: colors.accent, borderRadius: radius.lg, padding: space.lg, gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Icon name="video" size={20} color={colors.onAccent} />
          <Txt variant="label" tone="onAccent">
            New session
          </Txt>
        </View>
        <Txt variant="title" tone="onAccent">
          Start bowling analysis
        </Txt>
        <Txt variant="small" tone="onAccent" style={{ opacity: 0.9 }}>
          Film a session from a tripod. The app follows the bowler and draws the skeleton on the replay.
        </Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start bowling analysis"
          onPress={() => router.push(app.activeBowler ? '/session/new' : '/bowler/edit')}
          style={({ pressed }) => ({
            minHeight: 48,
            borderRadius: radius.md,
            backgroundColor: pressed ? colors.accentSoft : colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: space.sm,
          })}
        >
          <Icon name="play" size={20} color={colors.accent} />
          <Txt variant="heading" tone="accent">
            {app.activeBowler ? 'Start' : 'Add a bowler first'}
          </Txt>
        </Pressable>
      </View>

      <Card>
        <SectionTitle icon="calendar-days">Today</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg }}>
          <Stat value={String(today.deliveries)} caption="Deliveries marked" />
          <Stat value={String(today.sessions)} caption="Sessions" />
          <Stat value="--" caption="Average speed" />
          <Stat value="--" caption="Action consistency" />
        </View>
        <Txt variant="small" tone="muted">
          Speed needs ball tracking and calibration (Phase 4). Consistency needs delivery phase detection (Phase 3). They show -- until they can be measured.
        </Txt>
      </Card>

      <Card>
        <SectionTitle icon="clock">Recent sessions</SectionTitle>
        {recent.length === 0 ? (
          <EmptyState
            icon="video"
            title="No sessions yet"
            detail="Your recordings will appear here with their frame rate and tracking result."
          />
        ) : (
          <View>
            {recent.map((s) => (
              <SessionRow key={s.id} session={s} bowler={app.myBowlers.find((b) => b.id === s.bowlerId)} />
            ))}
          </View>
        )}
        {app.mySessions.length > 5 ? <Button label="All sessions" variant="secondary" onPress={() => router.push('/progress')} /> : null}
      </Card>
    </Screen>
  );
}
