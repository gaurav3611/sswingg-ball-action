import { Platform } from 'react-native';
import { NoCamera } from '@/components/no-camera';

export default function ImportVideo() {
  if (Platform.OS === 'web') return <NoCamera title="Analyse a video" detail="Analysing a video runs on a phone, where the video is stored." />;
  const { ImportScreen } = require('@/analysis/import-screen') as typeof import('@/analysis/import-screen');
  return <ImportScreen />;
}
