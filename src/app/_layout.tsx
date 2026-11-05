import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { SourceSerif4_600SemiBold, SourceSerif4_700Bold } from '@expo-google-fonts/source-serif-4';
import { AppProvider, useApp } from '@/state/app';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Routes />
      </AppProvider>
    </SafeAreaProvider>
  );
}

/** The splash stays up until the fonts and the saved data are loaded. */
function Routes() {
  const app = useApp();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SourceSerif4_600SemiBold,
    SourceSerif4_700Bold,
  });
  const ready = (fontsLoaded || fontError) && app.ready;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  const signedIn = app.onboarded && !!app.account;
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'none' }}>
        <Stack.Protected guard={!app.onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={app.onboarded && !app.account}>
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="bowler/edit" />
          <Stack.Screen name="session/new" />
          <Stack.Screen name="session/setup" />
          <Stack.Screen name="session/live" options={{ gestureEnabled: false }} />
          <Stack.Screen name="session/[id]" />
          <Stack.Screen name="feature/[id]" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="status" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
