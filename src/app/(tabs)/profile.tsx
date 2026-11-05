import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Button, Card, Chip, EmptyState, SectionTitle, Txt } from '@/components/ui';
import { displayArm } from '@/data/validation';
import { useApp } from '@/state/app';
import { colors, space } from '@/theme/tokens';

export default function Profile() {
  const app = useApp();
  const confirmSignOut = () => {
    app.logout();
  };

  return (
    <Screen title="Profile">
      <Card>
        <SectionTitle icon="user">Account</SectionTitle>
        <Txt variant="heading">{app.account?.name}</Txt>
        <Txt variant="small" tone="muted">
          {app.account?.email}
        </Txt>
        <View style={{ flexDirection: 'row' }}>
          <Chip label={app.account?.role === 'coach' ? 'Coach' : 'Bowler'} tone="accent" />
        </View>
      </Card>

      <Card>
        <SectionTitle icon="users">Bowlers</SectionTitle>
        {app.myBowlers.length === 0 ? (
          <EmptyState icon="user" title="No bowler profiles" detail="A profile holds the bowling arm and style that the analysis needs. Height, weight and age are optional." />
        ) : (
          app.myBowlers.map((b) => {
            const active = app.activeBowler?.id === b.id;
            return (
              <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${b.name}${active ? ', selected' : ', select'}`}
                  onPress={() => app.setActiveBowler(b.id)}
                  style={{ flex: 1, minHeight: 56, justifyContent: 'center', gap: 4 }}
                >
                  <Txt variant="body" style={{ fontFamily: 'Inter_600SemiBold' }}>
                    {b.name}
                  </Txt>
                  <Txt variant="small" tone="muted">
                    {displayArm(b)}, {b.style}, {b.experience}
                  </Txt>
                  {active ? <Chip label="Recording for this bowler" tone="accent" icon="check" /> : null}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${b.name}`}
                  onPress={() => router.push({ pathname: '/bowler/edit', params: { id: b.id } })}
                  style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icon name="settings" size={20} color={colors.muted} />
                </Pressable>
              </View>
            );
          })
        )}
        <Button label="Add a bowler" icon="plus" variant="secondary" onPress={() => router.push('/bowler/edit')} />
      </Card>

      <Card>
        <SectionTitle icon="shield-check">App</SectionTitle>
        <Button label="Settings and privacy" icon="lock" variant="secondary" onPress={() => router.push('/settings')} />
        <Button label="What works in this version" icon="info" variant="secondary" onPress={() => router.push('/status')} />
        <Button label="Sign out" icon="log-out" variant="ghost" onPress={confirmSignOut} />
      </Card>
    </Screen>
  );
}
