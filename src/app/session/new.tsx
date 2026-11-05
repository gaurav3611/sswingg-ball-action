import { Platform } from 'react-native';
import { NoCamera } from '@/components/no-camera';

export default function NewSession() {
  if (Platform.OS === 'web') return <NoCamera title="New session" />;
  // Loaded only on a phone: the camera libraries have nothing to load in a browser.
  const { NewSessionForm } = require('@/camera/new-session-form') as typeof import('@/camera/new-session-form');
  return <NewSessionForm />;
}
