import { Platform } from 'react-native';
import { NoCamera } from '@/components/no-camera';

export default function Setup() {
  if (Platform.OS === 'web') return <NoCamera title="Camera setup" />;
  const { SetupGuide } = require('@/camera/setup-guide') as typeof import('@/camera/setup-guide');
  return <SetupGuide />;
}
