import { Tabs } from 'expo-router';
import { Icon } from '@/components/icon';
import type { IconName } from '@/components/icon-data';
import { colors, fonts } from '@/theme/tokens';

const tab = (title: string, icon: IconName) => ({
  title,
  tabBarIcon: ({ focused }: { focused: boolean }) => <Icon name={icon} size={22} color={focused ? colors.accent : colors.muted} />,
});

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.uiSemi, fontSize: 12 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: 1, minHeight: 60 },
        tabBarItemStyle: { paddingVertical: 4 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={tab('Home', 'house')} />
      <Tabs.Screen name="analyse" options={tab('Analyse', 'camera')} />
      <Tabs.Screen name="progress" options={tab('Progress', 'chart-line')} />
      <Tabs.Screen name="profile" options={tab('Profile', 'user')} />
    </Tabs>
  );
}
