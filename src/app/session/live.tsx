import { Platform } from 'react-native';
import { NoCamera } from '@/components/no-camera';

export default function Live() {
  if (Platform.OS === 'web') return <NoCamera title="Live camera" />;
  const { LiveScreen } = require('@/camera/live-screen') as typeof import('@/camera/live-screen');
  return <LiveScreen />;
}
