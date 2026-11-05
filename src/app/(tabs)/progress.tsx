import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { SessionRow } from '@/components/session-row';
import { Button, Card, Chip, EmptyState, SectionTitle, Stat, Txt } from '@/components/ui';
import { weeklyDeliveries } from '@/data/summary';
import { useApp } from '@/state/app';
import { colors, radius, space } from '@/theme/tokens';

export default function Progress() {
  const app = useApp();
  const weeks = weeklyDeliveries(app.mySessions, Date.now(), 4);
  const max = Math.max(1, ...weeks);
  const total = app.mySessions.reduce((n, s) => n + s.deliveries.length, 0);
  const labels = ['3 weeks ago', '2 weeks ago', 'Last week', 'This week'];

  return (
    <Screen title="Progress">
      <Card>
        <SectionTitle icon="gauge">Workload</SectionTitle>
        <View style={{ flexDirection: 'row', gap: space.lg, flexWrap: 'wrap' }}>
          <Stat value={String(app.mySessions.length)} caption="Sessions recorded" />
          <Stat value={String(total)} caption="Deliveries marked" />
        </View>
        {weeks.map((n, i) => (
          <View key={i} style={{ gap: 4 }} accessible accessibilityLabel={`${labels[i]}: ${n} deliveries marked`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt variant="small" tone="muted">
                {labels[i]}
              </Txt>
              <Txt variant="small" style={{ fontVariant: ['tabular-nums'] }}>
                {n}
              </Txt>
            </View>
            <View style={{ height: 10, backgroundColor: colors.surface2, borderRadius: radius.sm }}>
              <View style={{ height: 10, width: `${(n / max) * 100}%`, backgroundColor: colors.accent, borderRadius: radius.sm }} />
            </View>
          </View>
        ))}
        <Txt variant="small" tone="muted">
          Counted from the deliveries you mark while recording. Weeks run back from today in blocks of 7 days.
        </Txt>
      </Card>

      <Card>
        <SectionTitle icon="chart-line">Trends and comparison</SectionTitle>
        <Txt variant="body">Performance trends and side by side session comparison need metrics that this version does not measure yet.</Txt>
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Chip label="Not built yet, phase 5" tone="neutral" />
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/feature/comparison')}>
          <Txt variant="small" tone="accent" style={{ fontFamily: 'Inter_600SemiBold' }}>
            What it will need
          </Txt>
        </Pressable>
      </Card>

      <Card>
        <SectionTitle icon="clock">All sessions</SectionTitle>
        {app.mySessions.length === 0 ? (
          <EmptyState icon="video" title="No sessions yet" detail="Record a session and it will be listed here." action={<Button label="Start a session" onPress={() => router.push('/session/new')} />} />
        ) : (
          app.mySessions.map((s) => <SessionRow key={s.id} session={s} bowler={app.myBowlers.find((b) => b.id === s.bowlerId)} />)
        )}
      </Card>
    </Screen>
  );
}
